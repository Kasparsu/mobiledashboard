/**
 * peatus.ee journey planner client (Digitransit / OpenTripPlanner v1).
 * Endpoint: POST api.peatus.ee/routing/v1/routers/estonia/index/graphql
 * CORS is wide open; no key required.
 */

const ENDPOINT = 'https://api.peatus.ee/routing/v1/routers/estonia/index/graphql'

/** The only operator we route through — Aktsiaselts Tallinna Linnatransport.
 *  All other agencies (HANSABUSS AS, GoBus, regional ops, intercity, ELRON, ferries...)
 *  are banned server-side so OTP won't suggest them. */
export const ALLOWED_AGENCY_IDS = ['estonia:tallinn_10312960']

export type Leg = {
  mode: string
  startTime: number
  endTime: number
  duration: number
  distance: number
  from: { name: string; lat: number; lon: number }
  to: { name: string; lat: number; lon: number }
  route?: {
    shortName: string
    longName?: string
    mode: string
    agency?: { gtfsId: string; name: string } | null
  } | null
  trip?: { tripHeadsign: string } | null
}

export type Itinerary = {
  startTime: number
  endTime: number
  duration: number
  walkDistance: number
  legs: Leg[]
}

export type TransportProfile = 'transit' | 'bike' | 'walk'

/** OTP TraverseMode sets per profile.
 *  "transit" = Tallinn city transit only (bus, tram; trolleys are classified as BUS in the GTFS feed). Excludes RAIL / FERRY for city commutes. */
export const PROFILE_MODES: Record<TransportProfile, string> = {
  transit: 'WALK,BUS,TRAM',
  bike: 'BICYCLE',
  walk: 'WALK',
}

export type PlanOptions = {
  numItineraries?: number
  /** Depart at / after this time. Default: now. */
  departAt?: Date
  /** Prefer arriving by this time instead of departing at. */
  arriveBy?: Date
  /** Pick a preset profile; overridden by `modes` if also given. */
  profile?: TransportProfile
  /** Raw OTP mode string (e.g. "WALK,BUS,TRAM"). Overrides `profile`. */
  modes?: string
  signal?: AbortSignal
}

const PLAN_QUERY = `
query plan(
  $from: InputCoordinates!
  $to: InputCoordinates!
  $numItineraries: Int
  $date: String
  $time: String
  $arriveBy: Boolean
  $modes: String
  $banned: InputBanned
) {
  plan(
    from: $from
    to: $to
    numItineraries: $numItineraries
    date: $date
    time: $time
    arriveBy: $arriveBy
    modes: $modes
    banned: $banned
  ) {
    itineraries {
      startTime
      endTime
      duration
      walkDistance
      legs {
        mode
        startTime
        endTime
        duration
        distance
        from { name lat lon }
        to { name lat lon }
        route { shortName longName mode agency { gtfsId name } }
        trip { tripHeadsign }
      }
    }
  }
}
`.trim()

const AGENCIES_QUERY = '{ agencies { gtfsId name } }'

let bannedAgencyIdsPromise: Promise<string> | null = null

async function getBannedAgencyIds(): Promise<string> {
  if (bannedAgencyIdsPromise) return bannedAgencyIdsPromise
  bannedAgencyIdsPromise = (async () => {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: AGENCIES_QUERY }),
      })
      if (!res.ok) return ''
      const data = (await res.json()) as {
        data?: { agencies?: Array<{ gtfsId: string }> }
      }
      const all = data.data?.agencies ?? []
      const allow = new Set(ALLOWED_AGENCY_IDS)
      return all
        .map((a) => a.gtfsId)
        .filter((id) => !allow.has(id))
        .join(',')
    } catch {
      return ''
    }
  })()
  return bannedAgencyIdsPromise
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function fmtTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** Nudge a coord by small offsets — 0 ≈ exact, 1 ≈ 22 m, 2 ≈ 55 m, 3 ≈ 110 m. */
const NUDGE_OFFSETS: Array<[number, number]> = [
  [0, 0],
  [0.0002, 0], [-0.0002, 0], [0, 0.0002], [0, -0.0002],
  [0.0005, 0], [-0.0005, 0], [0, 0.0005], [0, -0.0005],
  [0.001, 0], [-0.001, 0], [0, 0.001], [0, -0.001],
]

export async function planJourney(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  opts: PlanOptions = {},
): Promise<Itinerary[]> {
  const when = opts.arriveBy ?? opts.departAt ?? new Date()
  const profile = opts.profile ?? 'transit'
  // Only ban other agencies when we actually use transit. Bike/walk plans don't need it.
  const bannedAgencies = profile === 'transit' ? await getBannedAgencyIds() : ''
  const wanted = opts.numItineraries ?? 3
  // Over-fetch for transit because the client-side agency whitelist may drop
  // some itineraries where OTP returned non-TLT alternatives despite the ban.
  const serverRequest = profile === 'transit' ? Math.max(8, wanted * 3) : wanted

  // OTP is finicky about whether an exact coord snaps to the OSM walkable
  // graph — a GPS reading 30 m inside a building can return 0 itineraries
  // while the same coord 20 m away works. Try small offsets until we land on
  // a routable point.
  let lastItineraries: Itinerary[] = []
  for (const [dLat, dLng] of NUDGE_OFFSETS) {
    const variables = {
      from: { lat: from.lat + dLat, lon: from.lng + dLng },
      to: { lat: to.lat, lon: to.lng },
      numItineraries: serverRequest,
      date: fmtDate(when),
      time: fmtTime(when),
      arriveBy: !!opts.arriveBy,
      modes: opts.modes ?? PROFILE_MODES[profile],
      banned: bannedAgencies ? { agencies: bannedAgencies } : null,
    }
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: PLAN_QUERY, variables }),
      signal: opts.signal,
    })
    if (!res.ok) throw new Error(`peatus: HTTP ${res.status}`)
    const data = (await res.json()) as {
      data?: { plan?: { itineraries?: Itinerary[] } }
      errors?: { message?: string }[]
    }
    if (data.errors?.length) throw new Error(data.errors[0]?.message ?? 'GraphQL error')
    const all = data.data?.plan?.itineraries ?? []
    if (all.length === 0) continue // try next nudge

    // Non-transit profiles pass through unfiltered.
    if (profile !== 'transit') return all.slice(0, wanted)

    // OTP's banned.agencies isn't a hard filter; enforce the whitelist client-side.
    const allowed = new Set(ALLOWED_AGENCY_IDS)
    const filtered = all.filter((it) =>
      it.legs.every((l) => {
        if (l.mode === 'WALK') return true
        const gid = l.route?.agency?.gtfsId
        return !!gid && allowed.has(gid)
      }),
    )
    if (filtered.length > 0) return filtered.slice(0, wanted)

    // OTP returned itineraries but all were non-TLT. Remember as fallback and
    // try next nudge before giving up.
    if (lastItineraries.length === 0) lastItineraries = filtered
  }
  return lastItineraries
}

/** Short preview of an itinerary — e.g. "Bus 27 · 23 min". */
export function itinerarySummary(it: Itinerary): string {
  const transit = it.legs.find((l) => l.mode !== 'WALK')
  const rn = transit?.route?.shortName
  const modeLabel = transit
    ? `${humanMode(transit.mode)}${rn ? ' ' + rn : ''}`
    : 'Walk'
  const durMin = Math.round(it.duration / 60)
  return `${modeLabel} · ${durMin} min`
}

export function humanMode(mode: string): string {
  switch (mode.toUpperCase()) {
    case 'BUS':
      return 'Bus'
    case 'TRAM':
      return 'Tram'
    case 'TROLLEYBUS':
      return 'Trolley'
    case 'RAIL':
      return 'Train'
    case 'FERRY':
      return 'Ferry'
    case 'SUBWAY':
      return 'Metro'
    case 'WALK':
      return 'Walk'
    default:
      return mode
  }
}

export function iconForMode(mode: string): string {
  switch (mode.toUpperCase()) {
    case 'BUS':
      return 'ph:bus-bold'
    case 'TRAM':
      return 'ph:tram-bold'
    case 'TROLLEYBUS':
      return 'ph:bus-bold'
    case 'RAIL':
      return 'ph:train-bold'
    case 'FERRY':
      return 'ph:boat-bold'
    case 'WALK':
      return 'ph:person-simple-walk-bold'
    default:
      return 'ph:path-bold'
  }
}

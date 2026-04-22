/**
 * peatus.ee journey planner client (Digitransit / OpenTripPlanner v1).
 * Endpoint: POST api.peatus.ee/routing/v1/routers/estonia/index/graphql
 * CORS is wide open; no key required.
 */

const ENDPOINT = 'https://api.peatus.ee/routing/v1/routers/estonia/index/graphql'

export type Leg = {
  mode: string
  startTime: number
  endTime: number
  duration: number
  distance: number
  from: { name: string; lat: number; lon: number }
  to: { name: string; lat: number; lon: number }
  route?: { shortName: string; longName?: string; mode: string } | null
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
) {
  plan(
    from: $from
    to: $to
    numItineraries: $numItineraries
    date: $date
    time: $time
    arriveBy: $arriveBy
    modes: $modes
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
        route { shortName longName mode }
        trip { tripHeadsign }
      }
    }
  }
}
`.trim()

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

export async function planJourney(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  opts: PlanOptions = {},
): Promise<Itinerary[]> {
  const when = opts.arriveBy ?? opts.departAt ?? new Date()
  const variables = {
    from: { lat: from.lat, lon: from.lng },
    to: { lat: to.lat, lon: to.lng },
    numItineraries: opts.numItineraries ?? 3,
    date: fmtDate(when),
    time: fmtTime(when),
    arriveBy: !!opts.arriveBy,
    modes: opts.modes ?? PROFILE_MODES[opts.profile ?? 'transit'],
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
  return data.data?.plan?.itineraries ?? []
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

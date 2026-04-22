export type NominatimAddress = {
  road?: string
  house_number?: string
  suburb?: string
  quarter?: string
  city?: string
  town?: string
  village?: string
  postcode?: string
  country?: string
  country_code?: string
  [key: string]: string | undefined
}

export type NominatimPlace = {
  display_name: string
  lat: string
  lon: string
  address?: NominatimAddress
}

// Nominatim usage policy requires ≤1 request/sec; queue calls.
let tail: Promise<unknown> = Promise.resolve()
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const next = tail.then(async () => {
    const t0 = Date.now()
    try {
      return await fn()
    } finally {
      const elapsed = Date.now() - t0
      if (elapsed < 1100) await new Promise((r) => setTimeout(r, 1100 - elapsed))
    }
  })
  tail = next.catch(() => undefined)
  return next as Promise<T>
}

export function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<NominatimPlace | null> {
  return throttle(async () => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=et,en`
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return (await res.json()) as NominatimPlace
  })
}

export function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<NominatimPlace[]> {
  return throttle(async () => {
    if (!query.trim()) return []
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=8&accept-language=et,en`
    const res = await fetch(url, { signal })
    if (!res.ok) return []
    return (await res.json()) as NominatimPlace[]
  })
}

/** Compact address line — "Road 12, City" */
export function shortAddress(place: NominatimPlace | null): string {
  if (!place) return ''
  const a = place.address ?? {}
  const street = [a.road, a.house_number].filter(Boolean).join(' ')
  const city = a.city || a.town || a.village || a.quarter || a.suburb
  return [street, city].filter(Boolean).join(', ') || place.display_name
}

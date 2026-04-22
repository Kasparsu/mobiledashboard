export type LatLng = { lat: number; lng: number }

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Find the nearest location within `maxMeters` (or null). */
export function nearestLocation<T extends LatLng>(
  point: LatLng,
  candidates: T[],
  maxMeters: number,
): { location: T; distance: number } | null {
  let best: { location: T; distance: number } | null = null
  for (const c of candidates) {
    const d = haversineMeters(point, c)
    if (d <= maxMeters && (!best || d < best.distance)) {
      best = { location: c, distance: d }
    }
  }
  return best
}

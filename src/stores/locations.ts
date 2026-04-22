import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { nearestLocation } from '@/lib/geo'
import { useHistoryStore } from './history'

export type Location = {
  id: string
  name: string
  lat: number
  lng: number
  icon?: string
}

export type DetectResult =
  | { kind: 'matched'; locationId: string; distance: number; accuracy: number }
  | { kind: 'no-match'; distance: number | null; accuracy: number }
  | { kind: 'error'; message: string }

const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36))

export const useLocationsStore = defineStore(
  'locations',
  () => {
    const locations = ref<Location[]>([])
    const currentId = ref<string | null>(null)
    const autoDetect = ref(true)
    const radiusMeters = ref(150)
    const manualOverride = ref(false)
    const lastFix = ref<{ lat: number; lng: number; accuracy: number; at: number } | null>(null)
    const lastDetect = ref<DetectResult | null>(null)

    const current = computed(() =>
      currentId.value ? locations.value.find((l) => l.id === currentId.value) ?? null : null,
    )

    function add(input: Omit<Location, 'id'>): Location {
      const loc: Location = { ...input, id: uid() }
      locations.value.push(loc)
      return loc
    }

    function update(id: string, patch: Partial<Omit<Location, 'id'>>) {
      const existing = locations.value.find((l) => l.id === id)
      if (!existing) return
      Object.assign(existing, patch)
    }

    function remove(id: string) {
      locations.value = locations.value.filter((l) => l.id !== id)
      if (currentId.value === id) currentId.value = null
    }

    /** Manually set current (also flips `manualOverride` so auto-detect doesn't stomp it). */
    function setCurrent(id: string | null) {
      currentId.value = id
      manualOverride.value = id !== null
    }

    function clearOverride() {
      manualOverride.value = false
    }

    async function captureGps(): Promise<{ lat: number; lng: number; accuracy: number }> {
      if (!('geolocation' in navigator)) {
        throw new Error('Geolocation not supported in this browser')
      }
      return await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          (err) => reject(new Error(err.message)),
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
        )
      })
    }

    /** Read GPS and match to the nearest configured location within radius. */
    async function detectCurrent(): Promise<DetectResult> {
      try {
        const fix = await captureGps()
        const at = Date.now()
        lastFix.value = { ...fix, at }

        const history = useHistoryStore()

        if (locations.value.length === 0) {
          const r: DetectResult = { kind: 'no-match', distance: null, accuracy: fix.accuracy }
          lastDetect.value = r
          history.append({
            at,
            lat: fix.lat,
            lng: fix.lng,
            accuracy: fix.accuracy,
            matchedLocationId: null,
            distanceToMatch: null,
          })
          return r
        }

        const match = nearestLocation(fix, locations.value, radiusMeters.value)
        const wider = nearestLocation(fix, locations.value, Infinity)

        if (match) {
          if (!manualOverride.value) currentId.value = match.location.id
          const r: DetectResult = {
            kind: 'matched',
            locationId: match.location.id,
            distance: match.distance,
            accuracy: fix.accuracy,
          }
          lastDetect.value = r
          history.append({
            at,
            lat: fix.lat,
            lng: fix.lng,
            accuracy: fix.accuracy,
            matchedLocationId: match.location.id,
            distanceToMatch: match.distance,
          })
          return r
        }

        if (!manualOverride.value) currentId.value = null
        const r: DetectResult = {
          kind: 'no-match',
          distance: wider?.distance ?? null,
          accuracy: fix.accuracy,
        }
        lastDetect.value = r
        history.append({
          at,
          lat: fix.lat,
          lng: fix.lng,
          accuracy: fix.accuracy,
          matchedLocationId: null,
          distanceToMatch: wider?.distance ?? null,
        })
        return r
      } catch (e) {
        const r: DetectResult = {
          kind: 'error',
          message: e instanceof Error ? e.message : String(e),
        }
        lastDetect.value = r
        return r
      }
    }

    return {
      locations,
      currentId,
      current,
      autoDetect,
      radiusMeters,
      manualOverride,
      lastFix,
      lastDetect,
      add,
      update,
      remove,
      setCurrent,
      clearOverride,
      captureGps,
      detectCurrent,
    }
  },
  {
    persist: {
      key: 'mobiledashboard.locations',
      storage: localStorage,
      pick: ['locations', 'currentId', 'autoDetect', 'radiusMeters', 'manualOverride'],
    },
  },
)

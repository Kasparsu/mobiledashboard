import { defineStore } from 'pinia'
import { ref } from 'vue'
import { planJourney, type Itinerary, type TransportProfile } from '@/lib/peatus'
import type { Location } from './locations'

type CacheKey = string // `${fromId}->${toId}::${profile}`
type CacheEntry = {
  itineraries: Itinerary[]
  fetchedAt: number
  error?: string
}

const TTL_MS = 60_000 // 1 minute

export const useCommuteStore = defineStore(
  'commute',
  () => {
    const cache = ref<Record<CacheKey, CacheEntry>>({})
    const busy = ref<Record<CacheKey, boolean>>({})
    const profile = ref<TransportProfile>('transit')

    const keyOf = (fromId: string, toId: string, p: TransportProfile) =>
      `${fromId}->${toId}::${p}`

    const isFresh = (entry: CacheEntry | undefined) =>
      !!entry && Date.now() - entry.fetchedAt < TTL_MS

    async function routeBetween(
      from: Location,
      to: Location,
      opts: { profile?: TransportProfile; force?: boolean } = {},
    ): Promise<CacheEntry> {
      const p = opts.profile ?? profile.value
      const key = keyOf(from.id, to.id, p)
      const current = cache.value[key]
      if (!opts.force && current && isFresh(current)) return current
      if (busy.value[key] && current) return current

      busy.value[key] = true
      try {
        const itineraries = await planJourney(
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
          { numItineraries: 3, profile: p },
        )
        const entry: CacheEntry = { itineraries, fetchedAt: Date.now() }
        cache.value[key] = entry
        return entry
      } catch (e) {
        const entry: CacheEntry = {
          itineraries: [],
          fetchedAt: Date.now(),
          error: e instanceof Error ? e.message : String(e),
        }
        cache.value[key] = entry
        return entry
      } finally {
        busy.value[key] = false
      }
    }

    const get = (fromId: string, toId: string, p?: TransportProfile) =>
      cache.value[keyOf(fromId, toId, p ?? profile.value)]

    const isBusy = (fromId: string, toId: string, p?: TransportProfile) =>
      !!busy.value[keyOf(fromId, toId, p ?? profile.value)]

    function invalidate() {
      cache.value = {}
    }

    return { routeBetween, get, isBusy, invalidate, profile }
  },
  {
    persist: {
      key: 'mobiledashboard.commute',
      storage: localStorage,
      pick: ['profile'],
    },
  },
)

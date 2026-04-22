import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type HistoryEntry = {
  at: number            // ms epoch
  lat: number
  lng: number
  accuracy: number
  matchedLocationId: string | null
  distanceToMatch: number | null  // meters to nearest saved location (whether matched or not)
}

/** Contiguous run of fixes attributed to the same (or no) location. */
export type Segment = {
  locationId: string | null
  startMs: number
  endMs: number
  count: number
}

const MAX_ENTRIES = 10_000          // ~7 days at 1 fix/min
const SEGMENT_GAP_MS = 3 * 60_000   // treat gaps > 3 min as "no data"

export const useHistoryStore = defineStore(
  'history',
  () => {
    const entries = ref<HistoryEntry[]>([])

    function append(e: HistoryEntry) {
      // Skip dupes within 2 seconds (double triggers from manual refresh + interval)
      const last = entries.value[entries.value.length - 1]
      if (last && e.at - last.at < 2000) return
      entries.value.push(e)
      if (entries.value.length > MAX_ENTRIES) {
        entries.value.splice(0, entries.value.length - MAX_ENTRIES)
      }
    }

    function clear() {
      entries.value = []
    }

    /** Group entries by calendar day (local time), newest day first. */
    const byDay = computed(() => {
      const map = new Map<string, HistoryEntry[]>()
      for (const e of entries.value) {
        const d = new Date(e.at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const arr = map.get(key) ?? []
        arr.push(e)
        map.set(key, arr)
      }
      return [...map.entries()].sort(([a], [b]) => b.localeCompare(a))
    })

    /** Compute segments (grouped runs) for a given day (YYYY-MM-DD). */
    function segmentsForDay(dayKey: string): Segment[] {
      const day = byDay.value.find(([k]) => k === dayKey)
      if (!day) return []
      const items = day[1]
      if (items.length === 0) return []
      const segments: Segment[] = []
      let cur: Segment | null = null
      for (const e of items) {
        if (!cur) {
          cur = {
            locationId: e.matchedLocationId,
            startMs: e.at,
            endMs: e.at,
            count: 1,
          }
          continue
        }
        const gap = e.at - cur.endMs
        if (e.matchedLocationId === cur.locationId && gap <= SEGMENT_GAP_MS) {
          cur.endMs = e.at
          cur.count++
        } else {
          segments.push(cur)
          cur = {
            locationId: e.matchedLocationId,
            startMs: e.at,
            endMs: e.at,
            count: 1,
          }
        }
      }
      if (cur) segments.push(cur)
      return segments
    }

    /** Total milliseconds spent at each location over the given entries. */
    function dwellTimes(items: HistoryEntry[]): Map<string | null, number> {
      const out = new Map<string | null, number>()
      for (let i = 0; i < items.length - 1; i++) {
        const a = items[i]!
        const b = items[i + 1]!
        const gap = b.at - a.at
        if (gap > SEGMENT_GAP_MS) continue
        // attribute the gap to the location at start of it
        out.set(a.matchedLocationId, (out.get(a.matchedLocationId) ?? 0) + gap)
      }
      return out
    }

    return { entries, append, clear, byDay, segmentsForDay, dwellTimes }
  },
  {
    persist: {
      key: 'mobiledashboard.history',
      storage: localStorage,
      pick: ['entries'],
    },
  },
)

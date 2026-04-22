import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  fetchTimetable,
  weekRange,
  type Lesson,
  type SearchResult,
} from '@/lib/tahvel'

export type Target = SearchResult

type SerializableLesson = {
  start: string
  end: string
  subject: string
  room: string
  teacher: string
  group: string
}

const STALE_MS = 30 * 60_000 // 30 minutes

export const useScheduleStore = defineStore(
  'schedule',
  () => {
    const target = ref<Target | null>(null)
    const stored = ref<SerializableLesson[]>([])
    const fetchedAt = ref<number | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    const events = computed<Lesson[]>(() =>
      stored.value
        .map((l) => ({
          ...l,
          start: new Date(l.start),
          end: new Date(l.end),
        }))
        .sort((a, b) => +a.start - +b.start),
    )

    function setTarget(t: Target | null) {
      target.value = t
      stored.value = []
      fetchedAt.value = null
      error.value = null
    }

    async function load(force = false): Promise<void> {
      if (!target.value) return
      if (!force && fetchedAt.value && Date.now() - fetchedAt.value < STALE_MS) return
      loading.value = true
      error.value = null
      try {
        const { from, thru } = weekRange()
        const lessons = await fetchTimetable(target.value, { from, thru })
        stored.value = lessons
          .filter((l) => Number.isFinite(+l.start) && Number.isFinite(+l.end))
          .map((l) => ({
            start: l.start.toISOString(),
            end: l.end.toISOString(),
            subject: l.subject,
            room: l.room,
            teacher: l.teacher,
            group: l.group,
          }))
        fetchedAt.value = Date.now()
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      } finally {
        loading.value = false
      }
    }

    const now = ref(Date.now())
    // Cheap time-based reactivity: tick every 30s so "in X min" updates.
    if (typeof window !== 'undefined') {
      window.setInterval(() => (now.value = Date.now()), 30_000)
    }

    const currentLesson = computed<Lesson | null>(() => {
      const n = now.value
      return events.value.find((l) => +l.start <= n && n <= +l.end) ?? null
    })

    const nextLesson = computed<Lesson | null>(() => {
      const n = now.value
      return events.value.find((l) => +l.start > n) ?? null
    })

    const todaysLessons = computed<Lesson[]>(() => {
      const n = new Date(now.value)
      return events.value.filter(
        (l) =>
          l.start.getFullYear() === n.getFullYear() &&
          l.start.getMonth() === n.getMonth() &&
          l.start.getDate() === n.getDate(),
      )
    })

    const remainingTodaysLessons = computed<Lesson[]>(() => {
      const n = now.value
      return todaysLessons.value.filter((l) => +l.end >= n)
    })

    return {
      target,
      events,
      loading,
      error,
      fetchedAt,
      currentLesson,
      nextLesson,
      todaysLessons,
      remainingTodaysLessons,
      setTarget,
      load,
    }
  },
  {
    persist: {
      key: 'mobiledashboard.schedule',
      storage: localStorage,
      pick: ['target', 'stored', 'fetchedAt'],
    },
  },
)

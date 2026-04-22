<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { useHistoryStore } from '@/stores/history'
import { useLocationsStore, type Location } from '@/stores/locations'

const history = useHistoryStore()
const locations = useLocationsStore()
const { entries, byDay } = storeToRefs(history)
const { locations: savedLocations } = storeToRefs(locations)

const tab = ref<'history' | 'timeline'>('timeline')

const savedById = computed(() => {
  const m = new Map<string, Location>()
  for (const l of savedLocations.value) m.set(l.id, l)
  return m
})

/** Stable color per location id. */
const colorPalette = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#f43f5e',
]
function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
  return Math.abs(h)
}
function colorFor(id: string | null): string {
  if (id === null) return 'transparent'
  return colorPalette[hashId(id) % colorPalette.length]!
}
function labelFor(id: string | null): string {
  if (id === null) return 'Unmatched'
  return savedById.value.get(id)?.name ?? '(deleted)'
}
function iconFor(id: string | null): string | undefined {
  if (id === null) return 'ph:question-bold'
  return savedById.value.get(id)?.icon ?? 'ph:map-pin-bold'
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(dayKey: string) {
  const d = new Date(dayKey + 'T00:00:00')
  return d.toLocaleDateString('et-EE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}
function fmtDuration(ms: number) {
  const min = Math.round(ms / 60_000)
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

// For timeline: each day's segments positioned 0-100% across the day
type DayRow = {
  key: string
  label: string
  segments: Array<{ locationId: string | null; leftPct: number; widthPct: number }>
}

const timelineRows = computed<DayRow[]>(() => {
  return byDay.value.slice(0, 14).map(([key]) => {
    const segs = history.segmentsForDay(key)
    const dayStart = new Date(key + 'T00:00:00').getTime()
    const dayMs = 24 * 60 * 60 * 1000
    return {
      key,
      label: fmtDate(key),
      segments: segs
        .filter((s) => s.locationId !== null) // hide no-match from timeline chart
        .map((s) => ({
          locationId: s.locationId,
          leftPct: Math.max(0, ((s.startMs - dayStart) / dayMs) * 100),
          widthPct: Math.min(
            100,
            ((s.endMs - s.startMs) / dayMs) * 100,
          ),
        })),
    }
  })
})

const todayDwell = computed(() => {
  const today = byDay.value[0]
  if (!today) return [] as Array<{ id: string | null; ms: number }>
  const map = history.dwellTimes(today[1])
  return [...map.entries()]
    .filter(([id]) => id !== null)
    .map(([id, ms]) => ({ id, ms }))
    .sort((a, b) => b.ms - a.ms)
})

function clearAll() {
  if (confirm('Delete all tracked history?')) history.clear()
}
</script>

<template>
  <section class="p-4 pb-24 max-w-xl mx-auto space-y-4">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Stats</h1>
      <button
        v-if="entries.length > 0"
        class="btn btn-sm btn-ghost text-error"
        :title="`Delete ${entries.length} entries`"
        @click="clearAll"
      >
        <Icon icon="ph:trash-bold" />
      </button>
    </header>

    <div class="text-sm text-base-content/70">
      {{ entries.length }} fixes recorded
    </div>

    <div role="tablist" class="tabs tabs-boxed">
      <button
        role="tab"
        class="tab"
        :class="{ 'tab-active': tab === 'timeline' }"
        @click="tab = 'timeline'"
      >
        Timeline
      </button>
      <button
        role="tab"
        class="tab"
        :class="{ 'tab-active': tab === 'history' }"
        @click="tab = 'history'"
      >
        History
      </button>
    </div>

    <!-- Timeline tab -->
    <div v-if="tab === 'timeline'" class="space-y-3">
      <div v-if="todayDwell.length" class="card bg-base-200">
        <div class="card-body p-4">
          <h3 class="font-semibold text-sm">Today so far</h3>
          <ul class="mt-1 space-y-1">
            <li
              v-for="d in todayDwell"
              :key="d.id ?? 'none'"
              class="flex items-center gap-2 text-sm"
            >
              <span
                class="inline-block w-3 h-3 rounded"
                :style="{ background: colorFor(d.id) }"
              />
              <Icon :icon="iconFor(d.id) ?? 'ph:map-pin-bold'" class="text-base" />
              <span class="flex-1 truncate">{{ labelFor(d.id) }}</span>
              <span class="font-mono tabular-nums">{{ fmtDuration(d.ms) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div
        v-if="timelineRows.length === 0"
        class="text-base-content/60 py-8 text-center"
      >
        No data yet. Leave the app running to start tracking.
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="row in timelineRows"
          :key="row.key"
          class="space-y-1"
        >
          <div class="text-xs text-base-content/70">{{ row.label }}</div>
          <div class="relative h-6 bg-base-200 rounded overflow-hidden">
            <div
              v-for="(seg, i) in row.segments"
              :key="i"
              class="absolute top-0 bottom-0"
              :style="{
                left: seg.leftPct + '%',
                width: seg.widthPct + '%',
                background: colorFor(seg.locationId),
                minWidth: '2px',
              }"
              :title="labelFor(seg.locationId)"
            />
            <!-- hour markers -->
            <div
              v-for="h in [6, 12, 18]"
              :key="h"
              class="absolute top-0 bottom-0 border-l border-base-300/50"
              :style="{ left: ((h / 24) * 100) + '%' }"
            />
          </div>
        </div>
        <div class="flex justify-between text-[10px] text-base-content/50 px-0.5">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>

        <!-- legend -->
        <div class="mt-3 flex flex-wrap gap-2">
          <div
            v-for="loc in savedLocations"
            :key="loc.id"
            class="inline-flex items-center gap-1 text-xs"
          >
            <span
              class="inline-block w-3 h-3 rounded"
              :style="{ background: colorFor(loc.id) }"
            />
            <span>{{ loc.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- History tab -->
    <div v-if="tab === 'history'" class="space-y-3">
      <div
        v-if="byDay.length === 0"
        class="text-base-content/60 py-8 text-center"
      >
        No data yet.
      </div>
      <div
        v-for="[dayKey, items] in byDay"
        :key="dayKey"
        class="space-y-1"
      >
        <h3 class="text-sm font-semibold text-base-content/70">{{ fmtDate(dayKey) }}</h3>
        <ul class="space-y-0.5">
          <li
            v-for="e in [...items].reverse()"
            :key="e.at"
            class="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-base-200"
          >
            <span class="font-mono tabular-nums text-base-content/70">{{ fmtTime(e.at) }}</span>
            <span
              class="inline-block w-2 h-2 rounded-full shrink-0"
              :style="{ background: colorFor(e.matchedLocationId) }"
            />
            <span class="flex-1 truncate">{{ labelFor(e.matchedLocationId) }}</span>
            <span class="text-xs text-base-content/50 font-mono">
              ±{{ Math.round(e.accuracy) }}m
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

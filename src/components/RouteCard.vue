<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { useCommuteStore } from '@/stores/commute'
import type { Location } from '@/stores/locations'
import { iconForMode, itinerarySummary, type Itinerary } from '@/lib/peatus'

const props = defineProps<{
  from: Location
  to: Location
}>()

const commute = useCommuteStore()
const { profile } = storeToRefs(commute)

async function load(force = false) {
  await commute.routeBetween(props.from, props.to, { force })
}

const entry = computed(() => commute.get(props.from.id, props.to.id))
const busy = computed(() => commute.isBusy(props.from.id, props.to.id))

const best = computed<Itinerary | null>(() => entry.value?.itineraries[0] ?? null)

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })
}
function durMin(s: number) {
  return Math.max(1, Math.round(s / 60))
}

onMounted(load)
watch(() => props.from.id + props.to.id + profile.value, () => load())
</script>

<template>
  <div class="card bg-base-200">
    <div class="card-body p-4 gap-2">
      <div class="flex items-center gap-2">
        <Icon v-if="to.icon" :icon="to.icon" class="text-xl" />
        <div class="flex-1 min-w-0">
          <div class="font-semibold truncate">To {{ to.name }}</div>
          <div class="text-xs text-base-content/60">
            From {{ from.name }}
          </div>
        </div>
        <button
          class="btn btn-xs btn-ghost btn-circle"
          :disabled="busy"
          title="Refresh"
          @click="load(true)"
        >
          <Icon v-if="!busy" icon="ph:arrows-clockwise-bold" />
          <span v-else class="loading loading-spinner loading-xs" />
        </button>
      </div>

      <div v-if="entry?.error" class="alert alert-error text-sm">
        {{ entry.error }}
      </div>

      <div v-else-if="!best && busy" class="flex items-center gap-2 text-sm text-base-content/60 py-2">
        <span class="loading loading-spinner loading-xs" />
        Planning…
      </div>

      <div v-else-if="!best" class="text-sm text-base-content/60 py-2">
        No route found.
      </div>

      <div v-else class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-lg font-bold">
            {{ fmt(best.startTime) }} → {{ fmt(best.endTime) }}
          </div>
          <div class="badge badge-ghost">{{ itinerarySummary(best) }}</div>
        </div>

        <div class="flex flex-wrap items-center gap-1 text-sm">
          <template v-for="(leg, i) in best.legs" :key="i">
            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-base-100">
              <Icon :icon="iconForMode(leg.mode)" />
              <span v-if="leg.route?.shortName" class="font-mono font-semibold">
                {{ leg.route.shortName }}
              </span>
              <span class="text-base-content/60 text-xs">
                {{ durMin(leg.duration) }}m
              </span>
            </span>
            <Icon
              v-if="i < best.legs.length - 1"
              icon="ph:caret-right"
              class="text-base-content/40"
            />
          </template>
        </div>

        <details v-if="best.legs.length > 1" class="text-xs text-base-content/70">
          <summary class="cursor-pointer">Details</summary>
          <ul class="mt-1 space-y-1">
            <li v-for="(leg, i) in best.legs" :key="i" class="flex items-center gap-2">
              <Icon :icon="iconForMode(leg.mode)" class="text-base" />
              <span class="font-mono">{{ fmt(leg.startTime) }}</span>
              <span class="truncate">{{ leg.from.name }} → {{ leg.to.name }}</span>
              <span v-if="leg.route?.shortName" class="font-mono font-semibold">
                {{ leg.route.shortName }}
              </span>
            </li>
          </ul>
        </details>
      </div>
    </div>
  </div>
</template>

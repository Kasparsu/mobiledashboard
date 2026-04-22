<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { useLocationsStore } from '@/stores/locations'
import LocationMap from '@/components/LocationMap.vue'

const locations = useLocationsStore()
const { locations: list, current, autoDetect, lastDetect, manualOverride } = storeToRefs(locations)

const detecting = ref(false)
let refreshTimer: number | null = null

async function refresh() {
  if (detecting.value) return
  detecting.value = true
  try {
    await locations.detectCurrent()
  } finally {
    detecting.value = false
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && autoDetect.value) refresh()
}

onMounted(() => {
  if (autoDetect.value && list.value.length > 0) refresh()
  document.addEventListener('visibilitychange', onVisibilityChange)
  // Re-detect every 5 minutes while visible
  refreshTimer = window.setInterval(
    () => {
      if (document.visibilityState === 'visible' && autoDetect.value) refresh()
    },
    5 * 60 * 1000,
  )
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (refreshTimer) window.clearInterval(refreshTimer)
})

const markers = computed(() => {
  const fix = locations.lastFix
  const base = list.value.map((l) => ({
    id: l.id,
    lat: l.lat,
    lng: l.lng,
    label: l.name,
    current: false,
  }))
  if (fix) {
    base.push({
      id: '__gps__',
      lat: fix.lat,
      lng: fix.lng,
      label: 'You',
      current: true,
    })
  }
  return base
})

const center = computed(() =>
  locations.lastFix
    ? { lat: locations.lastFix.lat, lng: locations.lastFix.lng }
    : current.value
      ? { lat: current.value.lat, lng: current.value.lng }
      : list.value[0]
        ? { lat: list.value[0].lat, lng: list.value[0].lng }
        : null,
)

const statusLine = computed(() => {
  if (detecting.value) return 'Detecting…'
  if (!lastDetect.value) return autoDetect.value ? 'Tap refresh to detect' : 'Auto-detect disabled'
  const r = lastDetect.value
  if (r.kind === 'error') return `GPS error: ${r.message}`
  if (r.kind === 'matched') {
    const loc = list.value.find((l) => l.id === r.locationId)
    return `${loc?.name ?? '—'} · ${Math.round(r.distance)} m away · ±${Math.round(r.accuracy)} m`
  }
  if (r.kind === 'no-match') {
    const dist = r.distance != null ? `${Math.round(r.distance)} m from nearest` : 'no locations set'
    return `Not at any saved location · ${dist} · ±${Math.round(r.accuracy)} m`
  }
  return ''
})
</script>

<template>
  <section class="p-4 pb-24 max-w-xl mx-auto space-y-4">
    <header class="flex items-center justify-between gap-2">
      <h1 class="text-2xl font-bold">Now</h1>
      <div class="flex items-center gap-2">
        <div v-if="current" class="badge badge-primary gap-1">
          <Icon icon="ph:map-pin-bold" />
          {{ current.name }}
        </div>
        <RouterLink v-else-if="list.length === 0" to="/config" class="btn btn-sm btn-outline">
          Set location
        </RouterLink>
        <button
          class="btn btn-sm btn-circle btn-ghost"
          :disabled="detecting || list.length === 0"
          title="Refresh GPS"
          @click="refresh"
        >
          <Icon v-if="!detecting" icon="ph:arrows-clockwise-bold" />
          <span v-else class="loading loading-spinner loading-sm" />
        </button>
      </div>
    </header>

    <LocationMap
      v-if="markers.length"
      :center="center"
      :markers="markers"
      :fit-bounds="markers.length > 1"
      height="14rem"
    />

    <div v-if="list.length === 0" class="card bg-base-200">
      <div class="card-body">
        <p class="text-base-content/70">
          Add locations in <RouterLink to="/config" class="link">Config</RouterLink>
          to get started.
        </p>
      </div>
    </div>

    <div v-else class="card bg-base-200">
      <div class="card-body gap-2">
        <div class="flex items-center gap-2 text-sm">
          <Icon icon="ph:crosshair-bold" class="text-base-content/70" />
          <span>{{ statusLine }}</span>
        </div>
        <div v-if="manualOverride" class="flex items-center gap-2 text-xs text-warning">
          <Icon icon="ph:lock-bold" />
          <span>Manual override active</span>
          <button class="btn btn-xs btn-ghost" @click="locations.clearOverride()">
            Release
          </button>
        </div>
        <p v-if="current" class="text-base-content/60 text-sm">
          Schedule &amp; commute insights will appear here once wired up.
        </p>
      </div>
    </div>
  </section>
</template>

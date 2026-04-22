<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { useLocationsStore } from '@/stores/locations'
import { useCommuteStore } from '@/stores/commute'
import LocationMap from '@/components/LocationMap.vue'
import RouteCard from '@/components/RouteCard.vue'

const locations = useLocationsStore()
const { locations: list, current, autoDetect, lastDetect, manualOverride } = storeToRefs(locations)

const commute = useCommuteStore()
const { profile } = storeToRefs(commute)

const detecting = ref(false)

async function refresh() {
  if (detecting.value) return
  detecting.value = true
  try {
    await locations.detectCurrent()
  } finally {
    detecting.value = false
  }
}

const markers = computed(() => {
  const fix = locations.lastFix
  const base: import('@/components/LocationMap.vue').MapMarker[] = list.value.map((l) => ({
    id: l.id,
    lat: l.lat,
    lng: l.lng,
    label: l.name,
    icon: l.icon,
    current: l.id === current.value?.id,
  }))
  if (fix) {
    base.push({
      id: '__gps__',
      lat: fix.lat,
      lng: fix.lng,
      label: 'You',
      pulse: true,
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

// Pick an origin for routing: matched location if present, otherwise the raw
// GPS fix as a synthetic "You" location. Cache key rounds coords to ~100 m so
// we re-plan when the user actually moves, not on every fix jitter.
const fromNode = computed(() => {
  if (current.value) return current.value
  const fix = locations.lastFix
  if (!fix) return null
  const latR = fix.lat.toFixed(3)
  const lngR = fix.lng.toFixed(3)
  return {
    id: `__gps__:${latR},${lngR}`,
    name: 'Current position',
    lat: fix.lat,
    lng: fix.lng,
  }
})

const destinations = computed(() =>
  fromNode.value ? list.value.filter((l) => l.id !== fromNode.value!.id) : [],
)
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
      </div>
    </div>

    <div v-if="fromNode && destinations.length" class="space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Getting there</h2>
        <div class="join" role="tablist">
          <button
            class="btn btn-xs join-item"
            :class="profile === 'transit' ? 'btn-primary' : 'btn-ghost'"
            @click="profile = 'transit'"
          >
            <Icon icon="ph:bus-bold" />
            Transit
          </button>
          <button
            class="btn btn-xs join-item"
            :class="profile === 'bike' ? 'btn-primary' : 'btn-ghost'"
            @click="profile = 'bike'"
          >
            <Icon icon="ph:bicycle-bold" />
            Bike
          </button>
          <button
            class="btn btn-xs join-item"
            :class="profile === 'walk' ? 'btn-primary' : 'btn-ghost'"
            @click="profile = 'walk'"
          >
            <Icon icon="ph:person-simple-walk-bold" />
            Walk
          </button>
        </div>
      </div>
      <RouteCard
        v-for="to in destinations"
        :key="to.id + profile"
        :from="fromNode!"
        :to="to"
      />
    </div>
  </section>
</template>

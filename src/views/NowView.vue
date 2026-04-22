<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { useLocationsStore } from '@/stores/locations'
import LocationMap from '@/components/LocationMap.vue'

const locations = useLocationsStore()
const { locations: list, current } = storeToRefs(locations)

const markers = computed(() =>
  list.value.map((l) => ({
    id: l.id,
    lat: l.lat,
    lng: l.lng,
    label: l.name,
    current: l.id === current.value?.id,
  })),
)

const center = computed(() =>
  current.value
    ? { lat: current.value.lat, lng: current.value.lng }
    : list.value[0]
      ? { lat: list.value[0].lat, lng: list.value[0].lng }
      : null,
)
</script>

<template>
  <section class="p-4 pb-24 max-w-xl mx-auto space-y-4">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Now</h1>
      <div v-if="current" class="badge badge-primary gap-1">
        <Icon icon="ph:map-pin-bold" />
        {{ current.name }}
      </div>
      <RouterLink v-else to="/config" class="btn btn-sm btn-outline">
        Set location
      </RouterLink>
    </header>

    <LocationMap
      v-if="markers.length"
      :center="center"
      :markers="markers"
      :fit-bounds="markers.length > 1"
      height="14rem"
    />

    <div v-if="!current" class="card bg-base-200">
      <div class="card-body">
        <p class="text-base-content/70">
          <template v-if="markers.length === 0">
            Add locations in <RouterLink to="/config" class="link">Config</RouterLink>
            to get started.
          </template>
          <template v-else>
            Mark one of your locations as "current" in
            <RouterLink to="/config" class="link">Config</RouterLink>
            to see contextual info here.
          </template>
        </p>
      </div>
    </div>

    <div v-else class="card bg-base-200">
      <div class="card-body">
        <div class="flex items-center gap-2 text-sm text-base-content/70">
          <Icon icon="ph:map-pin-bold" />
          You're at {{ current.name }}
        </div>
        <p class="text-base-content/60 text-sm">
          Schedule &amp; commute insights will appear here once wired up.
        </p>
      </div>
    </div>
  </section>
</template>

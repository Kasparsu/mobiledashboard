<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { useLocationsStore, type Location } from '@/stores/locations'
import LocationMap from '@/components/LocationMap.vue'
import IconPicker from '@/components/IconPicker.vue'
import { reverseGeocode, shortAddress, type NominatimPlace } from '@/lib/nominatim'

const locations = useLocationsStore()
const { locations: list, currentId, autoDetect, radiusMeters } = storeToRefs(locations)

type Draft = {
  id: string | null
  name: string
  lat: string
  lng: string
  icon: string
}

const blank = (): Draft => ({ id: null, name: '', lat: '', lng: '', icon: '' })
const draft = ref<Draft>(blank())
const isEditing = ref(false)
const gpsError = ref<string | null>(null)
const gpsBusy = ref(false)
const geocodePlace = ref<NominatimPlace | null>(null)
const geocodeBusy = ref(false)

const draftLat = computed(() => Number.parseFloat(draft.value.lat))
const draftLng = computed(() => Number.parseFloat(draft.value.lng))
const draftHasCoords = computed(
  () => Number.isFinite(draftLat.value) && Number.isFinite(draftLng.value),
)
const draftCenter = computed(() =>
  draftHasCoords.value ? { lat: draftLat.value, lng: draftLng.value } : null,
)
const draftMarkers = computed(() =>
  draftHasCoords.value
    ? [
        {
          id: 'draft',
          lat: draftLat.value,
          lng: draftLng.value,
          label: draft.value.name || 'New location',
          icon: draft.value.icon || undefined,
          current: true,
        },
      ]
    : [],
)

function startAdd() {
  draft.value = blank()
  isEditing.value = true
  gpsError.value = null
  geocodePlace.value = null
}

function startEdit(loc: Location) {
  draft.value = {
    id: loc.id,
    name: loc.name,
    lat: String(loc.lat),
    lng: String(loc.lng),
    icon: loc.icon ?? '',
  }
  isEditing.value = true
  gpsError.value = null
  geocodePlace.value = null
  runReverseGeocode()
}

function cancel() {
  isEditing.value = false
  draft.value = blank()
  gpsError.value = null
  geocodePlace.value = null
}

function save() {
  const name = draft.value.name.trim()
  if (!name || !draftHasCoords.value) return

  const payload = {
    name,
    lat: draftLat.value,
    lng: draftLng.value,
    icon: draft.value.icon.trim() || undefined,
  }

  if (draft.value.id) {
    locations.update(draft.value.id, payload)
  } else {
    locations.add(payload)
  }
  cancel()
}

async function captureGps() {
  gpsBusy.value = true
  gpsError.value = null
  try {
    const { lat, lng } = await locations.captureGps()
    draft.value.lat = lat.toFixed(6)
    draft.value.lng = lng.toFixed(6)
  } catch (e) {
    gpsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    gpsBusy.value = false
  }
}

function onMapClick(lat: number, lng: number) {
  draft.value.lat = lat.toFixed(6)
  draft.value.lng = lng.toFixed(6)
}

function onMarkerDrag(_id: string, lat: number, lng: number) {
  draft.value.lat = lat.toFixed(6)
  draft.value.lng = lng.toFixed(6)
}

let geocodeAbort: AbortController | null = null
async function runReverseGeocode() {
  if (!draftHasCoords.value) {
    geocodePlace.value = null
    return
  }
  geocodeAbort?.abort()
  geocodeAbort = new AbortController()
  geocodeBusy.value = true
  try {
    geocodePlace.value = await reverseGeocode(
      draftLat.value,
      draftLng.value,
      geocodeAbort.signal,
    )
  } catch {
    // ignore
  } finally {
    geocodeBusy.value = false
  }
}

// Debounce reverse-geocode on coord changes
let geocodeTimer: number | null = null
watch(
  () => [draftLat.value, draftLng.value] as const,
  () => {
    if (!isEditing.value) return
    if (geocodeTimer) window.clearTimeout(geocodeTimer)
    geocodeTimer = window.setTimeout(runReverseGeocode, 400)
  },
)

function useSuggestedName() {
  if (!geocodePlace.value) return
  draft.value.name = shortAddress(geocodePlace.value)
}

function toggleCurrent(id: string) {
  locations.setCurrent(currentId.value === id ? null : id)
}

function confirmDelete(loc: Location) {
  if (confirm(`Delete "${loc.name}"?`)) locations.remove(loc.id)
}
</script>

<template>
  <section class="p-4 pb-24 max-w-xl mx-auto space-y-4">
    <header class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Config</h1>
    </header>

    <div class="card bg-base-200">
      <div class="card-body p-4 gap-3">
        <h2 class="text-lg font-semibold">Auto-detect</h2>
        <label class="label cursor-pointer justify-start gap-3 p-0">
          <input
            v-model="autoDetect"
            type="checkbox"
            class="toggle toggle-primary"
          />
          <span class="label-text">
            Detect current location from GPS
            <span class="block text-xs text-base-content/60">
              Matches your device position against saved locations.
            </span>
          </span>
        </label>
        <label class="form-control">
          <span class="label-text">
            Match radius: <span class="font-mono">{{ radiusMeters }} m</span>
          </span>
          <input
            v-model.number="radiusMeters"
            type="range"
            min="50"
            max="500"
            step="10"
            class="range range-primary range-sm"
          />
          <div class="flex justify-between text-xs text-base-content/60 px-1">
            <span>50 m</span>
            <span>500 m</span>
          </div>
        </label>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Locations</h2>
        <button v-if="!isEditing" class="btn btn-sm btn-primary" @click="startAdd">
          <Icon icon="ph:plus-bold" />
          Add
        </button>
      </div>

      <form
        v-if="isEditing"
        class="card bg-base-200"
        @submit.prevent="save"
      >
        <div class="card-body gap-3 p-4">
          <label class="form-control">
            <span class="label-text">Name</span>
            <input
              v-model="draft.name"
              type="text"
              class="input input-bordered w-full"
              placeholder="Home, Work, School…"
              autofocus
            />
          </label>

          <LocationMap
            :center="draftCenter"
            :markers="draftMarkers"
            click-to-set
            draggable
            height="14rem"
            @map-click="onMapClick"
            @marker-drag="onMarkerDrag"
          />
          <p class="text-xs text-base-content/60">
            Click on the map or drag the pin to adjust.
          </p>

          <div class="grid grid-cols-2 gap-2">
            <label class="form-control">
              <span class="label-text">Latitude</span>
              <input
                v-model="draft.lat"
                type="text"
                class="input input-bordered"
                inputmode="decimal"
              />
            </label>
            <label class="form-control">
              <span class="label-text">Longitude</span>
              <input
                v-model="draft.lng"
                type="text"
                class="input input-bordered"
                inputmode="decimal"
              />
            </label>
          </div>

          <div v-if="draftHasCoords" class="text-sm">
            <div v-if="geocodeBusy" class="flex items-center gap-2 text-base-content/60">
              <span class="loading loading-spinner loading-xs" />
              Looking up address…
            </div>
            <div v-else-if="geocodePlace" class="flex items-start justify-between gap-2">
              <div>
                <div class="font-medium">{{ shortAddress(geocodePlace) }}</div>
                <div class="text-xs text-base-content/60 truncate">
                  {{ geocodePlace.display_name }}
                </div>
              </div>
              <button
                type="button"
                class="btn btn-xs btn-ghost"
                @click="useSuggestedName"
              >
                Use as name
              </button>
            </div>
          </div>

          <div class="form-control">
            <span class="label-text mb-1">Icon (optional)</span>
            <IconPicker v-model="draft.icon" />
          </div>

          <div v-if="gpsError" class="alert alert-error text-sm">
            {{ gpsError }}
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-outline"
              :disabled="gpsBusy"
              @click="captureGps"
            >
              <Icon v-if="!gpsBusy" icon="ph:crosshair-bold" />
              <span v-if="gpsBusy" class="loading loading-spinner loading-sm" />
              Capture GPS
            </button>
            <span class="flex-1" />
            <button type="button" class="btn btn-ghost" @click="cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="!draftHasCoords || !draft.name.trim()">
              Save
            </button>
          </div>
        </div>
      </form>

      <p v-if="list.length === 0 && !isEditing" class="text-base-content/60 py-8 text-center">
        No locations yet. Add your home, work, and school to get started.
      </p>

      <ul class="space-y-2">
        <li
          v-for="loc in list"
          :key="loc.id"
          class="card bg-base-200"
          :class="{ 'outline outline-2 outline-primary': loc.id === currentId }"
        >
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <Icon
                v-if="loc.icon"
                :icon="loc.icon"
                class="text-2xl"
              />
              <div class="flex-1 min-w-0">
                <div class="font-semibold truncate">{{ loc.name }}</div>
                <div class="text-xs text-base-content/60 font-mono">
                  {{ loc.lat.toFixed(5) }}, {{ loc.lng.toFixed(5) }}
                </div>
              </div>
              <div class="flex gap-1">
                <button
                  class="btn btn-sm btn-circle"
                  :class="loc.id === currentId ? 'btn-primary' : 'btn-ghost'"
                  :title="loc.id === currentId ? 'You are here' : 'Mark as current'"
                  @click="toggleCurrent(loc.id)"
                >
                  <Icon icon="ph:map-pin-bold" />
                </button>
                <button
                  class="btn btn-sm btn-circle btn-ghost"
                  title="Edit"
                  @click="startEdit(loc)"
                >
                  <Icon icon="ph:pencil-simple-bold" />
                </button>
                <button
                  class="btn btn-sm btn-circle btn-ghost text-error"
                  title="Delete"
                  @click="confirmDelete(loc)"
                >
                  <Icon icon="ph:trash-bold" />
                </button>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

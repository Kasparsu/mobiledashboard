<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

// Vite-friendly default marker asset paths. Drop _getIconUrl so merged options
// actually win over CSS-relative fallbacks in dev.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
})

export type MapMarker = {
  id: string
  lat: number
  lng: number
  label?: string
  icon?: string     // Iconify name, e.g. "ph:house-bold"
  current?: boolean // highlights with ring
  pulse?: boolean   // live GPS dot (overrides icon-based rendering)
}

const props = withDefaults(
  defineProps<{
    center?: { lat: number; lng: number } | null
    zoom?: number
    markers?: MapMarker[]
    clickToSet?: boolean
    draggable?: boolean
    height?: string
    fitBounds?: boolean
  }>(),
  {
    center: null,
    zoom: 14,
    markers: () => [],
    clickToSet: false,
    draggable: false,
    height: '16rem',
    fitBounds: false,
  },
)

const emit = defineEmits<{
  'map-click': [lat: number, lng: number]
  'marker-drag': [id: string, lat: number, lng: number]
}>()

const mapEl = ref<HTMLDivElement | null>(null)
const map = shallowRef<L.Map | null>(null)
const markerLayer = shallowRef<L.LayerGroup | null>(null)

function pulseIcon() {
  return L.divIcon({
    className: 'map-pulse-marker',
    html:
      '<span class="relative flex h-4 w-4">' +
      '<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50"></span>' +
      '<span class="relative inline-flex rounded-full h-4 w-4 bg-primary ring-2 ring-base-100 shadow-lg"></span>' +
      '</span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function iconBadge(icon: string, current: boolean) {
  const ringClass = current
    ? 'ring-4 ring-primary/40'
    : 'ring-2 ring-base-300'
  const bgClass = current ? 'bg-primary text-primary-content' : 'bg-base-100 text-base-content'
  return L.divIcon({
    className: 'map-icon-marker',
    html:
      `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full shadow-lg ${bgClass} ${ringClass}">` +
      `<iconify-icon icon="${icon}" width="20" height="20"></iconify-icon>` +
      '</span>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function pinIcon(current: boolean) {
  const ringClass = current ? 'ring-4 ring-primary/40' : 'ring-2 ring-base-300'
  const bgClass = current ? 'bg-primary text-primary-content' : 'bg-base-100 text-base-content'
  return L.divIcon({
    className: 'map-pin-marker',
    html:
      `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full shadow-lg ${bgClass} ${ringClass}">` +
      '<iconify-icon icon="ph:map-pin-bold" width="20" height="20"></iconify-icon>' +
      '</span>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function iconFor(m: MapMarker) {
  if (m.pulse) return pulseIcon()
  if (m.icon) return iconBadge(m.icon, !!m.current)
  return pinIcon(!!m.current)
}

function render() {
  if (!map.value || !markerLayer.value) return
  markerLayer.value.clearLayers()
  const bounds: L.LatLng[] = []
  for (const m of props.markers) {
    const latlng = L.latLng(m.lat, m.lng)
    bounds.push(latlng)
    const marker = L.marker(latlng, {
      icon: iconFor(m),
      draggable: props.draggable,
    })
    if (m.label) marker.bindTooltip(m.label, { direction: 'top', offset: [0, -18] })
    if (props.draggable) {
      marker.on('dragend', (e) => {
        const p = e.target.getLatLng()
        emit('marker-drag', m.id, p.lat, p.lng)
      })
    }
    marker.addTo(markerLayer.value)
  }
  if (props.fitBounds && bounds.length > 1) {
    map.value.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] })
  }
}

onMounted(() => {
  if (!mapEl.value) return
  const center = props.center ?? { lat: 59.437, lng: 24.7536 }
  const m = L.map(mapEl.value, { attributionControl: false }).setView(
    [center.lat, center.lng],
    props.zoom,
  )
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(m)
  L.control.attribution({ position: 'bottomright', prefix: false }).addTo(m)
  map.value = m
  markerLayer.value = L.layerGroup().addTo(m)

  if (props.clickToSet) {
    m.on('click', (e) => emit('map-click', e.latlng.lat, e.latlng.lng))
  }
  render()
})

watch(() => props.markers, render, { deep: true })
watch(
  () => props.center,
  (c) => {
    if (map.value && c) map.value.setView([c.lat, c.lng], map.value.getZoom())
  },
)

onUnmounted(() => {
  map.value?.remove()
  map.value = null
  markerLayer.value = null
})
</script>

<template>
  <div
    ref="mapEl"
    class="w-full rounded-xl overflow-hidden z-0"
    :style="{ height }"
  />
</template>

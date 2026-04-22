<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

// Vite-friendly marker asset paths.
// Without deleting _getIconUrl, dev mode falls back to CSS-relative paths and
// default markers silently fail to load.
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
  current?: boolean
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

function currentIcon() {
  return L.divIcon({
    className: 'current-marker',
    html:
      '<span class="block w-4 h-4 rounded-full bg-primary ring-4 ring-primary/30 shadow-lg"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function render() {
  if (!map.value || !markerLayer.value) return
  markerLayer.value.clearLayers()
  const bounds: L.LatLng[] = []
  for (const m of props.markers) {
    const latlng = L.latLng(m.lat, m.lng)
    bounds.push(latlng)
    const marker = m.current
      ? L.marker(latlng, { icon: currentIcon(), draggable: props.draggable })
      : L.marker(latlng, { draggable: props.draggable })
    if (m.label) marker.bindTooltip(m.label, { direction: 'top', offset: [0, -10] })
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
  const center = props.center ?? { lat: 59.437, lng: 24.7536 } // Tallinn fallback
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

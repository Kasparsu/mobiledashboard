<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useLocationsStore } from '@/stores/locations'

const locations = useLocationsStore()

let trackerId: number | null = null

function tick() {
  if (document.visibilityState !== 'visible') return
  if (!locations.autoDetect) return
  if (locations.locations.length === 0) return
  void locations.detectCurrent()
}

function onVisibility() {
  if (document.visibilityState === 'visible') tick()
}

onMounted(() => {
  // Fire once shortly after mount (so stores are hydrated), then every minute.
  window.setTimeout(tick, 250)
  trackerId = window.setInterval(tick, 60_000)
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  if (trackerId) window.clearInterval(trackerId)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="min-h-screen bg-base-100 text-base-content">
    <main class="min-h-screen">
      <RouterView />
    </main>

    <nav
      class="btm-nav fixed bottom-0 left-0 right-0 z-40 bg-base-200 border-t border-base-300 flex"
    >
      <RouterLink
        to="/"
        class="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
        active-class="text-primary"
      >
        <Icon icon="ph:clock-bold" class="text-2xl" />
        <span class="text-xs">Now</span>
      </RouterLink>
      <RouterLink
        to="/stats"
        class="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
        active-class="text-primary"
      >
        <Icon icon="ph:chart-line-bold" class="text-2xl" />
        <span class="text-xs">Stats</span>
      </RouterLink>
      <RouterLink
        to="/config"
        class="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
        active-class="text-primary"
      >
        <Icon icon="ph:gear-bold" class="text-2xl" />
        <span class="text-xs">Config</span>
      </RouterLink>
    </nav>
  </div>
</template>

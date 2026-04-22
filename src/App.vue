<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { Icon } from '@iconify/vue'
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

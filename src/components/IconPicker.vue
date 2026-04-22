<script setup lang="ts">
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { searchIcons } from '@/lib/iconify'

const props = defineProps<{
  modelValue: string
  prefix?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const query = ref('')
const results = ref<string[]>([])
const total = ref(0)
const busy = ref(false)
const allCollections = ref(false)

let abort: AbortController | null = null
let timer: number | null = null

async function runSearch() {
  const q = query.value.trim()
  if (!q) {
    results.value = []
    total.value = 0
    return
  }
  abort?.abort()
  abort = new AbortController()
  busy.value = true
  try {
    const data = await searchIcons(q, {
      prefix: allCollections.value ? undefined : (props.prefix ?? 'ph'),
      limit: 48,
      signal: abort.signal,
    })
    results.value = data.icons
    total.value = data.total
  } catch {
    // ignore abort/errors
  } finally {
    busy.value = false
  }
}

watch(query, () => {
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(runSearch, 250)
})

watch(allCollections, runSearch)

function select(name: string) {
  emit('update:modelValue', name)
}

function clear() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <div class="flex-1 relative">
        <input
          v-model="query"
          type="text"
          class="input input-bordered w-full pl-9"
          placeholder="Search icons… (e.g. house, briefcase, school)"
        />
        <Icon
          icon="ph:magnifying-glass-bold"
          class="absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
        />
      </div>
      <label class="label cursor-pointer gap-2 text-xs">
        <input
          v-model="allCollections"
          type="checkbox"
          class="checkbox checkbox-xs"
        />
        <span>All packs</span>
      </label>
    </div>

    <div v-if="modelValue" class="flex items-center gap-2 text-sm">
      <span class="text-base-content/60">Selected:</span>
      <Icon :icon="modelValue" class="text-2xl" />
      <span class="font-mono text-xs">{{ modelValue }}</span>
      <button type="button" class="btn btn-ghost btn-xs ml-auto" @click="clear">
        Clear
      </button>
    </div>

    <div v-if="busy" class="flex items-center gap-2 text-sm text-base-content/60 py-2">
      <span class="loading loading-spinner loading-xs" />
      Searching…
    </div>

    <div
      v-else-if="results.length"
      class="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto rounded-lg bg-base-100 p-2 border border-base-300"
    >
      <button
        v-for="name in results"
        :key="name"
        type="button"
        class="btn btn-ghost btn-sm aspect-square p-0 text-xl"
        :class="{ 'btn-active text-primary': name === modelValue }"
        :title="name"
        @click="select(name)"
      >
        <Icon :icon="name" />
      </button>
    </div>

    <p
      v-else-if="query.trim().length > 0"
      class="text-xs text-base-content/50 py-2"
    >
      No icons found.
    </p>
  </div>
</template>

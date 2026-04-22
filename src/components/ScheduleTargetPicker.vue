<script setup lang="ts">
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { search, type SearchResult } from '@/lib/tahvel'

const emit = defineEmits<{
  pick: [target: SearchResult]
}>()

const query = ref('')
const results = ref<SearchResult[]>([])
const busy = ref(false)
const showList = ref(false)

let abort: AbortController | null = null
let timer: number | null = null

async function runSearch() {
  const q = query.value.trim()
  if (q.length < 2) {
    results.value = []
    return
  }
  abort?.abort()
  abort = new AbortController()
  busy.value = true
  try {
    results.value = await search(q, abort.signal)
  } catch {
    results.value = []
  } finally {
    busy.value = false
  }
}

watch(query, () => {
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(runSearch, 300)
  showList.value = true
})

function pick(item: SearchResult) {
  emit('pick', item)
  query.value = ''
  results.value = []
  showList.value = false
}
</script>

<template>
  <div class="space-y-2">
    <div class="relative">
      <input
        v-model="query"
        type="text"
        class="input input-bordered w-full pl-9"
        placeholder="Search teacher or group (e.g. Kaspar, IATI21)"
        @focus="showList = true"
      />
      <Icon
        icon="ph:magnifying-glass-bold"
        class="absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
      />
      <span
        v-if="busy"
        class="absolute right-3 top-1/2 -translate-y-1/2 loading loading-spinner loading-xs"
      />
    </div>

    <ul
      v-if="showList && results.length"
      class="menu bg-base-100 rounded-box border border-base-300 max-h-60 overflow-y-auto"
    >
      <li v-for="r in results" :key="r.type + r.uuid">
        <button type="button" class="flex justify-between" @click="pick(r)">
          <span>{{ r.name }}</span>
          <span class="badge badge-ghost badge-sm">{{ r.type }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

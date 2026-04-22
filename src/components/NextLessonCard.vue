<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { useScheduleStore } from '@/stores/schedule'

const schedule = useScheduleStore()
const { target, currentLesson, nextLesson, loading, error, remainingTodaysLessons } = storeToRefs(schedule)

function fmtTime(d: Date) {
  return d.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })
}
function fmtDay(d: Date) {
  const today = new Date()
  const sameDay =
    today.getFullYear() === d.getFullYear() &&
    today.getMonth() === d.getMonth() &&
    today.getDate() === d.getDate()
  if (sameDay) return 'Täna'
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (
    tomorrow.getFullYear() === d.getFullYear() &&
    tomorrow.getMonth() === d.getMonth() &&
    tomorrow.getDate() === d.getDate()
  )
    return 'Homme'
  return d.toLocaleDateString('et-EE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function relative(to: Date) {
  const diffMs = +to - Date.now()
  if (diffMs <= 0) return 'now'
  const min = Math.round(diffMs / 60_000)
  if (min < 60) return `in ${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`
  const days = Math.round(h / 24)
  return `in ${days} days`
}

const ongoingEndsIn = computed(() => {
  if (!currentLesson.value) return ''
  return relative(currentLesson.value.end)
})

function refresh() {
  void schedule.load(true)
}
</script>

<template>
  <div v-if="target" class="card bg-base-200">
    <div class="card-body p-4 gap-2">
      <div class="flex items-center gap-2">
        <Icon icon="ph:graduation-cap-bold" class="text-xl" />
        <div class="flex-1 min-w-0">
          <div class="text-xs text-base-content/60 truncate">
            {{ target.name }} · {{ target.type }}
          </div>
        </div>
        <button
          class="btn btn-xs btn-ghost btn-circle"
          :disabled="loading"
          title="Refresh timetable"
          @click="refresh"
        >
          <Icon v-if="!loading" icon="ph:arrows-clockwise-bold" />
          <span v-else class="loading loading-spinner loading-xs" />
        </button>
      </div>

      <div v-if="error" class="alert alert-error text-xs">
        {{ error }}
      </div>

      <!-- Currently ongoing -->
      <div v-if="currentLesson">
        <div class="text-xs text-base-content/60">Praegu käib</div>
        <div class="font-semibold text-lg leading-tight">{{ currentLesson.subject }}</div>
        <div class="flex flex-wrap items-center gap-2 mt-1 text-sm">
          <span class="font-mono">
            {{ fmtTime(currentLesson.start) }}–{{ fmtTime(currentLesson.end) }}
          </span>
          <span v-if="currentLesson.room" class="badge badge-ghost">
            <Icon icon="ph:door-open-bold" class="mr-1" />
            {{ currentLesson.room }}
          </span>
          <span class="text-base-content/60">ends {{ ongoingEndsIn }}</span>
        </div>
      </div>

      <!-- Next lesson -->
      <div v-if="nextLesson" :class="currentLesson ? 'border-t border-base-300 pt-2' : ''">
        <div class="text-xs text-base-content/60">
          {{ currentLesson ? 'Järgmine' : 'Järgmine tund' }}
        </div>
        <div class="font-semibold text-lg leading-tight">{{ nextLesson.subject }}</div>
        <div class="flex flex-wrap items-center gap-2 mt-1 text-sm">
          <span class="font-mono">
            {{ fmtDay(nextLesson.start) }} · {{ fmtTime(nextLesson.start) }}
          </span>
          <span v-if="nextLesson.room" class="badge badge-ghost">
            <Icon icon="ph:door-open-bold" class="mr-1" />
            {{ nextLesson.room }}
          </span>
          <span class="text-base-content/60">{{ relative(nextLesson.start) }}</span>
        </div>
        <div v-if="target.type === 'teacher' && nextLesson.group" class="text-xs text-base-content/60 mt-0.5">
          Rühm: {{ nextLesson.group }}
        </div>
        <div v-else-if="target.type === 'group' && nextLesson.teacher" class="text-xs text-base-content/60 mt-0.5">
          Õpetaja: {{ nextLesson.teacher }}
        </div>
      </div>

      <div
        v-if="!currentLesson && !nextLesson && !loading"
        class="text-sm text-base-content/60"
      >
        No upcoming lessons this week.
      </div>

      <!-- Later today summary -->
      <div
        v-if="remainingTodaysLessons.length > 1 && !currentLesson"
        class="text-xs text-base-content/60 pt-1"
      >
        {{ remainingTodaysLessons.length - 1 }} more today
      </div>
    </div>
  </div>
</template>

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type Location = {
  id: string
  name: string
  lat: number
  lng: number
  icon?: string
}

const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36))

export const useLocationsStore = defineStore(
  'locations',
  () => {
    const locations = ref<Location[]>([])
    const currentId = ref<string | null>(null)

    const current = computed(() =>
      currentId.value ? locations.value.find((l) => l.id === currentId.value) ?? null : null,
    )

    function add(input: Omit<Location, 'id'>): Location {
      const loc: Location = { ...input, id: uid() }
      locations.value.push(loc)
      return loc
    }

    function update(id: string, patch: Partial<Omit<Location, 'id'>>) {
      const existing = locations.value.find((l) => l.id === id)
      if (!existing) return
      Object.assign(existing, patch)
    }

    function remove(id: string) {
      locations.value = locations.value.filter((l) => l.id !== id)
      if (currentId.value === id) currentId.value = null
    }

    function setCurrent(id: string | null) {
      currentId.value = id
    }

    async function captureGps(): Promise<{ lat: number; lng: number }> {
      if (!('geolocation' in navigator)) {
        throw new Error('Geolocation not supported in this browser')
      }
      return await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => reject(new Error(err.message)),
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
        )
      })
    }

    return { locations, currentId, current, add, update, remove, setCurrent, captureGps }
  },
  {
    persist: {
      key: 'mobiledashboard.locations',
      storage: localStorage,
    },
  },
)

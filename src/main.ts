import './assets/main.css'
import 'iconify-icon'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

// On-page devtools (Eruda). Toggle via URL query, persisted in localStorage.
//   ?debug=1  → enable and keep across reloads
//   ?debug=0  → disable
const DEBUG_KEY = 'mobiledashboard.debug'
try {
  const params = new URLSearchParams(location.search)
  const flag = params.get('debug')
  if (flag === '1') localStorage.setItem(DEBUG_KEY, '1')
  else if (flag === '0') localStorage.removeItem(DEBUG_KEY)
  if (localStorage.getItem(DEBUG_KEY) === '1') {
    import('eruda').then(({ default: eruda }) => eruda.init())
  }
} catch {
  // storage or URL might be unavailable in some contexts; ignore
}

import App from './App.vue'
import router from './router'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')

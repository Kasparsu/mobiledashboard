import { createRouter, createWebHistory } from 'vue-router'
import NowView from '../views/NowView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'now',
      component: NowView,
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('../views/StatsView.vue'),
    },
    {
      path: '/config',
      name: 'config',
      component: () => import('../views/ConfigView.vue'),
    },
  ],
})

export default router

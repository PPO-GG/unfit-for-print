// middleware/auth.ts
import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useUserStore } from '~/stores/userStore'

export default defineNuxtRouteMiddleware(async () => {
  // Session can only be verified client-side (cookie-based session)
  if (import.meta.server) return

  const userStore = useUserStore()

  if (!userStore.isLoggedIn) {
    try {
      await userStore.fetchSession()
    } catch (error) {
      // Transient failure (e.g. network error) — let the page render rather
      // than silently redirecting a user whose session may be perfectly valid.
      console.error('[middleware/auth] Failed to fetch session:', error)
      return
    }

    // Only redirect for a definitive "no session" result.
    if (!userStore.isLoggedIn) {
      return navigateTo('/')
    }
  }
})
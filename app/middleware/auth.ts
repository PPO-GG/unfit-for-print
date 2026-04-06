// middleware/auth.ts
import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useUserStore } from '~/stores/userStore'

export default defineNuxtRouteMiddleware(async () => {
  // Session can only be verified client-side (Appwrite SDK uses cookies)
  if (import.meta.server) return

  const userStore = useUserStore()

  if (!userStore.isLoggedIn) {
    const result = await userStore.fetchUserSession()

    // Only redirect for definitive auth failures — not transient network errors.
    // 'error' means Appwrite was unreachable; let the page render rather than
    // silently redirecting a user whose session may be perfectly valid.
    if (result === 'unauthenticated') {
      return navigateTo('/')
    }
  }
})
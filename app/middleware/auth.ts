// middleware/auth.ts
import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useUserStore } from '~/stores/userStore'

export default defineNuxtRouteMiddleware(async () => {
  // Session can only be verified client-side (Appwrite SDK uses cookies)
  if (import.meta.server) return

  const userStore = useUserStore()

  if (!userStore.isLoggedIn) {
    try {
      await userStore.fetchUserSession()

      if (!userStore.isLoggedIn) {
        return navigateTo('/')
      }
    } catch (error) {
      console.error('User is not authenticated:', error)
      return navigateTo('/')
    }
  }
})
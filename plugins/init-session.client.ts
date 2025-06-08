// plugins/initUser.client.ts
import { useUserStore } from '~/stores/userStore'

export default defineNuxtPlugin(() => {
  const userStore = useUserStore()

  if (!userStore.isLoggedIn) {
    void userStore.fetchUserSession().catch((error) => {
      console.error('Failed to fetch user session:', error)
    })
  }
})

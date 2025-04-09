// plugins/initUser.client.ts
import { useUserStore } from '~/stores/userStore'

export default defineNuxtPlugin(async () => {
  const userStore = useUserStore()

  if (!userStore.isLoggedIn) {
    await userStore.fetchUserSession()
  }
})
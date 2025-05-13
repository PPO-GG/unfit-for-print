// plugins/initUser.client.ts
import { useUserStore } from '~/stores/userStore'

export default defineNuxtPlugin(async () => {
  console.log('[init-session] Plugin initializing')
  const userStore = useUserStore()

  console.log('[init-session] Initial login state:', userStore.isLoggedIn)
  console.log('[init-session] Initial session state:', userStore.session ? 'Session exists' : 'No session')

  if (!userStore.isLoggedIn) {
    console.log('[init-session] User not logged in, fetching session')
    await userStore.fetchUserSession()
    console.log('[init-session] Session fetch complete, login state:', userStore.isLoggedIn)
    console.log('[init-session] Session state after fetch:', userStore.session ? 'Session exists' : 'No session')
  } else {
    console.log('[init-session] User already logged in, session ID:', userStore.session?.$id)
  }
})

<!-- pages/auth/callback.vue -->
<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { useNotifications } from '~/composables/useNotifications'

const userStore = useUserStore()
const router = useRouter()
const { notify } = useNotifications()

onMounted(async () => {
  try {
    console.log('Auth callback - starting session fetch')
    await userStore.fetchUserSession()

    if (userStore.isLoggedIn && userStore.user) {
      console.log('Auth successful - user:', userStore.user.provider)
      notify({ title: "Successfully logged in!", color: "success" })
      await router.push('/')
    } else {
      console.warn('Session fetch completed but user not logged in')
      notify({ title: "Login failed", color: "error" })
      await router.push('/login?error=not_authenticated')
    }
  } catch (error) {
    console.error('Auth callback error:', error)
    notify({ title: "Login failed", color: "error" })
    await router.push('/login?error=auth_failed')
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">Processing Login</h3>
      </template>
      <p>Please wait while we complete your login...</p>
    </UCard>
  </div>
</template>
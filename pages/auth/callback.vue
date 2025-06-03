<!-- pages/auth/callback.vue -->
<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { useNotifications } from '~/composables/useNotifications'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const userStore = useUserStore()
const router = useRouter()
const { notify } = useNotifications()

onMounted(async () => {
  try {
    console.log('Auth callback - starting session fetch')
    await userStore.fetchUserSession()

    if (userStore.isLoggedIn && userStore.user) {
      console.log('Auth successful - user:', userStore.user.provider)
      notify({ title: t('auth.login_successful'), color: "success" })
      await router.push('/')
    } else {
      console.warn('Session fetch completed but user not logged in')
      notify({ title: t('auth.login_fail'), color: "error" })
      await router.push('/?error=not_authenticated')
    }
  } catch (error) {
    console.error('Auth callback error:', error)
    notify({ title: t('auth.login_fail'), color: "error" })
    await router.push('/?error=auth_failed')
  }
})
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">{{ t('auth.processing_login') }}</h3>
      </template>
      <p>{{ t('auth.loading') }}</p>
    </UCard>
  </div>
</template>
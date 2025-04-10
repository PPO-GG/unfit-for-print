<!-- components/AppHeader.vue -->
<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { isAnonymousUser, isAuthenticatedUser } from '~/composables/useUserUtils'
import { useNotifications } from '~/composables/useNotifications'

const userStore = useUserStore()
const { notify } = useNotifications()

const handleLogout = async () => {
  try {
    await userStore.logout()
    notify("Logged out", "success")
  } catch (err) {
    notify("Logout failed", "error")
    console.error("Logout error:", err)
  }
}
</script>

<template>
  <header class="flex justify-between items-center p-4 bg-zinc-900 text-white shadow-md">
    <NuxtLink to="/" class="text-xl font-bold">Unfit For Print</NuxtLink>

    <nav class="flex items-center gap-4">
      <template v-if="isAuthenticatedUser(userStore.user)">
        <NuxtLink to="/profile" class="hover:underline">Profile</NuxtLink>
        <NuxtLink to="/lobby" class="hover:underline">Lobbies</NuxtLink>

        <img
            v-if="userStore.user?.prefs?.avatar"
            :src="`https://cdn.discordapp.com/avatars/${userStore.user.prefs.discordUserId}/${userStore.user.prefs.avatar}.png`"
            alt="avatar"
            class="w-8 h-8 rounded-full"
        />
        <button @click="handleLogout" class="text-sm text-red-400 hover:text-red-300">Logout</button>
      </template>

      <template v-else>
        <NuxtLink to="/join" class="hover:underline">Join Game</NuxtLink>
        <UButton @click="userStore.loginWithDiscord()" color="neutral" variant="outline">Button</UButton>
      </template>
    </nav>
  </header>
</template>

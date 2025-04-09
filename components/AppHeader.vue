<!-- components/AppHeader.vue -->
<script setup>
import { useUserStore } from '~/stores/userStore'
const userStore = useUserStore()
</script>

<template>
  <header class="flex justify-between p-4 items-center bg-zinc-900 text-white shadow-md">
    <div class="text-xl font-bold">
      <NuxtLink to="/">Unfit For Print</NuxtLink>
    </div>

    <nav class="flex items-center gap-4">
      <NuxtLink to="/" class="hover:underline">Home</NuxtLink>
      <NuxtLink v-if="userStore.isLoggedIn" to="/profile" class="hover:underline">Profile</NuxtLink>

      <button
        v-if="!userStore.isLoggedIn"
        @click="userStore.loginWithDiscord()"
        class="bg-blue-600 px-3 py-1 rounded-sm"
      >
        Login
      </button>

      <div v-else class="flex items-center gap-2">
        <button><NuxtLink to="/lobby">Lobbies</NuxtLink></button>
        <img
          v-if="userStore.user?.prefs?.avatar"
          :src="`https://cdn.discordapp.com/avatars/${userStore.user.prefs.discordUserId}/${userStore.user.prefs.avatar}.png`"
          alt="avatar"
          class="w-8 h-8 rounded-full"
        />
        <button @click="userStore.logout()" class="text-sm text-red-400 hover:underline">Logout</button>
      </div>
    </nav>
  </header>
</template>

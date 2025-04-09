<!-- components/AppHeader.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { useUserStore } from '~/stores/userStore';

let userStore: ReturnType<typeof useUserStore>

onMounted(() => {
  userStore = useUserStore()
})
</script>

<template>
  <header class="flex justify-between p-4 items-center bg-zinc-900 text-white shadow-md">
    <div class="text-xl font-bold">
      <NuxtLink to="/">Unfit For Print</NuxtLink>
    </div>

    <nav class="flex items-center gap-4" v-if="userStore">
      <NuxtLink to="/profile" class="hover:underline">Profile</NuxtLink>

      <div class="flex items-center gap-2">
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

    <nav class="flex items-center gap-4" v-else>
      <div class="flex items-center gap-2">
        <button><NuxtLink to="/lobby">Lobbies</NuxtLink></button>

        <button
            @click="userStore.loginWithDiscord()"
            class="bg-blue-600 px-3 py-1 rounded-sm"
        >
          Login
        </button>
      </div>
    </nav>
  </header>
</template>

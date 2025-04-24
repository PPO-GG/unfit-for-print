<!-- components/AppHeader.vue -->
<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { isAnonymousUser, isAuthenticatedUser } from '~/composables/useUserUtils'
import { useNotifications } from '~/composables/useNotifications'

const userStore = useUserStore()
const { notify } = useNotifications()

const handleLoginWithDiscord = async (): Promise<void> => {
  try {
    await userStore.loginWithProvider('discord');

    // Fetch full session + user info after login
    await userStore.fetchUserSession();

    notify({ title: "Logged in with Discord", color: "success" });
  } catch (err: any) {
    console.error("Login error:", err);

    let message = "Login failed";

    if (err?.message?.includes("already exists")) {
      message = "This Discord account is already tied to another user.";
    }

    notify({ title: message, color: "error" });
  }
};

const handleLoginWithGoogle = async (): Promise<void> => {
  try {
    await userStore.loginWithProvider('google');

    // Fetch full session + user info after login
    await userStore.fetchUserSession();

    notify({ title: "Logged in with Google", color: "success" });
  } catch (err: any) {
    console.error("Login error:", err);

    let message = "Login failed";

    if (err?.message?.includes("already exists")) {
      message = "This Google account is already tied to another user.";
    }

    notify({ title: message, color: "error" });
  }
};

const handleLogout = async () => {
  try {
    await userStore.logout()
    notify({title: "Logged out", color: "success"})
  } catch (err) {
    notify({title: "Logout failed", color: "error"})
    console.error("Logout error:", err)
  }
}

const avatarUrl = computed(() => {
  const user = userStore.user;
  if (!user?.prefs) return null;

  if (user.provider === 'discord' && user.prefs.discordUserId && user.prefs.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.prefs.discordUserId}/${user.prefs.avatar}.png`;
  }

  if (user.provider === 'google' && user.prefs.avatar) {
    return user.prefs.avatar; // Google usually gives a direct URL
  }

  return null;
});
</script>

<template>
  <header class="flex justify-between items-center p-4 bg-zinc-900 text-white shadow-md">
    <NuxtLink to="/" class="text-xl font-bold">Unfit For Print</NuxtLink>

    <nav class="flex items-center gap-4">
      <template v-if="isAuthenticatedUser(userStore.user)">
        <NuxtLink to="/profile" class="hover:underline">Profile</NuxtLink>
        <NuxtLink to="/game" class="hover:underline">Games</NuxtLink>

        <img
            v-if="avatarUrl"
            :src="avatarUrl"
            alt="avatar"
            class="w-8 h-8 rounded-full"
        />
        <UAvatar v-else size="sm" icon="i-heroicons-user" />
        <button @click="handleLogout" class="text-sm text-red-400 hover:text-red-300">Logout</button>
      </template>

      <template v-else>
        <NuxtLink to="/join" class="hover:underline">Join Game</NuxtLink>
        <UButton @click="handleLoginWithGoogle" color="neutral" variant="outline" icon="i-logos-google-icon">Login With Google</UButton>
        <UButton @click="handleLoginWithDiscord" color="neutral" variant="outline" icon="i-logos-discord-icon">Login With Discord</UButton>
      </template>
    </nav>
  </header>
</template>

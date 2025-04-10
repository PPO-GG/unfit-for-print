<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 text-white">
    <div v-if="!checkingLobby" class="bg-slate-800 p-6 rounded-lg shadow-lg w-full max-w-md">
      <h1 class="text-2xl font-bold mb-4">Join a Game</h1>

      <form @submit.prevent="onJoin" novalidate>
        <label class="block mb-2 text-sm font-medium">Username</label>
        <input
            v-model="username"
            type="text"
            required
            placeholder="e.g. RizzMaster69"
            class="w-full px-4 py-2 rounded-sm bg-slate-700 text-white mb-4"
        />

        <label class="block mb-2 text-sm font-medium">Lobby Code</label>
        <input
            v-model="lobbyCode"
            type="text"
            required
            placeholder="e.g. ABC123"
            class="w-full px-4 py-2 rounded-sm bg-slate-700 text-white mb-4 uppercase"
        />

        <p v-if="error" class="text-red-500 text-sm mb-4">{{ error }}</p>

        <button
            type="submit"
            :disabled="joining"
            class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-sm"
        >
          {{ joining ? 'Joining...' : 'Join Lobby' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import { useAppwrite } from "~/composables/useAppwrite";

const router = useRouter();
const route = useRoute();
const { getActiveLobbyForUser, handleJoin } = useLobby();
const userStore = useUserStore();

const username = ref("");
const lobbyCode = ref((route.query.code as string) || "");
const error = ref("");
const checkingLobby = ref(true);
const joining = ref(false);

onMounted(async () => {
  const appwrite = useAppwrite();
  if (!appwrite?.account) throw new Error("Appwrite account not initialized");

  if (!userStore.session) {
    await appwrite.account.createAnonymousSession();
  }

  await userStore.fetchUserSession();

  if (userStore.user?.$id) {
    const activeLobby = await getActiveLobbyForUser(userStore.user.$id);
    if (activeLobby) {
      return router.replace(`/lobby/${activeLobby.code}`);
    }
  }

  checkingLobby.value = false;
});

const onJoin = async () => {
  if (!username.value.trim()) {
    error.value = "Please enter a username.";
    return;
  }

  if (!lobbyCode.value.trim()) {
    error.value = "Lobby code is required.";
    return;
  }

  await handleJoin(
      username.value.trim(),
      lobbyCode.value.trim().toUpperCase(),
      error,
      joining,
      router
  );
};
</script>
<template>
  <div
    class="min-h-screen flex items-center justify-center bg-slate-900 text-white"
  >
    <div
      v-if="!checkingLobby"
      class="bg-slate-800 p-6 rounded-lg shadow-lg w-full max-w-md"
    >
      <h1 class="text-2xl font-bold mb-4">Join a Game</h1>

      <form @submit.prevent="handleJoin">
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
          class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-sm"
        >
          Join Lobby
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
import {useNotifications} from "~/composables/useNotifications";

const router = useRouter();
const route = useRoute();
const { joinLobby, getLobbyByCode, isInLobby, getActiveLobbyForUser } =
  useLobby();
const userStore = useUserStore();
const joining = ref(false);
const username = ref("");
const lobbyCode = ref(route.query.code || "");
const error = ref("");
const checkingLobby = ref(true);
const { notify } = useNotifications();

onMounted(async () => {
  if (!userStore.session) {
    const { account } = useAppwrite();
    await account.createAnonymousSession();
  }

  await userStore.fetchUserSession();

  if (userStore.user?.$id) {
    const activeLobby = await getActiveLobbyForUser(userStore.user.$id);
    if (activeLobby) {
      return router.replace(`/lobby/${activeLobby.$id}`);
    }
  }

  checkingLobby.value = false;
});

const handleJoin = async () => {
  if (joining.value) return;
  joining.value = true;

  try {
    const { account } = useAppwrite();
    error.value = "";

    // 1. Ensure session
    if (!userStore.session) await account.createAnonymousSession();
    await userStore.fetchUserSession();

    // 2. Get user and code
    const user = await account.get();
    const code = lobbyCode.value.toUpperCase();

    // 3. Get the lobby
    const lobby = await getLobbyByCode(code);
    if (!lobby) {
      error.value = "Lobby not found.";
      return;
    }

    // 4. Check if user already joined
    const inLobby = await isInLobby(user.$id, lobby.$id);
    if (inLobby) {
      return router.push(`/lobby/${lobby.code}`);
    }

    // 5. Join the lobby
    const joinedLobby = await joinLobby(code, { username: username.value });
    if (joinedLobby?.code) {
      await router.push(`/lobby/${joinedLobby.code}`);
    } else {
      error.value = "Failed to join the lobby.";
    }
  } catch (err: any) {
    error.value = err.message || "Something went wrong while joining.";
    console.error("Join error:", err);
  } finally {
    joining.value = false;
  }
};
</script>

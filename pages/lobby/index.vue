<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import {useAppwrite} from "~/composables/useAppwrite";

const { getActiveLobbyForUser, createLobby } = useLobby();
const userStore = useUserStore();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = computed(() => route.query.error);

// const isAnonymous = computed(() => {
//   return userStore.session?.provider === "anonymous";
// });
const isAnonymous = ref(false);

onMounted(async () => {
  try {
    if (import.meta.client) {
      let account;
      account = useAppwrite().account;
    // Ensure session exists
    if (!userStore.session) {
      await account.createAnonymousSession();
    }

    await userStore.fetchUserSession();

    const session = userStore.session;
    const user = userStore.user;

    if (!session || !user) {
      loading.value = false;
      return;
    }

    isAnonymous.value = session.provider === "anonymous";

    const activeLobby = await getActiveLobbyForUser(user.$id);
    if (activeLobby) {
      await router.push(`/lobby/${activeLobby.code}`);
      return;
    }

    if (isAnonymous.value) {
      await router.push("/join");
    }
    }
  } catch (err) {
    console.error("Error during session/lobby check:", err);
  } finally {
    loading.value = false;
  }
});

const handleCreate = async () => {
  if (!userStore.user) return; // guard just in case
  const lobby = await createLobby(userStore.user.$id);
  await router.push(`/lobby/${lobby.code}`);
};
</script>

<template>
  <div
    class="min-h-screen flex justify-center items-center bg-slate-900 text-white"
  >
    <p v-if="error === 'lobby_not_found'" class="text-red-500">
      Lobby not found. Please check the code and try again.
    </p>

    <div v-if="loading">Checking for existing lobbies...</div>

    <div v-else-if="isAnonymous">
      <p class="text-sm text-gray-400">Anonymous users can't create lobbies.</p>
      <NuxtLink to="/join">
        <button
          class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-sm shadow-sm"
        >
          Join a Lobby
        </button>
      </NuxtLink>
      <p class="text-sm text-gray-400 mt-2">
        <button
          class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-sm shadow-sm"
        >
          Or Login to create a lobby.
        </button>
      </p>
    </div>

    <div v-else>
      <button
        @click="handleCreate"
        class="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-sm shadow-sm"
      >
        Create Lobby
      </button>
    </div>
  </div>
</template>

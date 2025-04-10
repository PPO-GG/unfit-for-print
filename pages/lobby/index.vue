<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import {useAppwrite} from "~/composables/useAppwrite";
import {isAnonymousUser} from "~/composables/useUserUtils";

const { getActiveLobbyForUser, createLobby } = useLobby();
const userStore = useUserStore();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = computed(() => route.query.error);

const isAnonymous = ref(false);

onMounted(async () => {
  const getAppwrite = () => {
    if (import.meta.server) throw new Error("useLobby() cannot be used during SSR");
    const {databases, account, client} = useAppwrite();
    if (!databases || !account) throw new Error("Appwrite not initialized");
    return {databases, account, client};
  };
  try {
    const { account } = getAppwrite();
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

    const activeLobby = await getActiveLobbyForUser(user.$id);
    if (activeLobby) {
      const destination =
          activeLobby.status === 'playing'
              ? `/game/${activeLobby.code}`
              : `/lobby/${activeLobby.code}`;

      await router.replace(destination);
    }

    if (isAnonymousUser(user)) {
      await router.push("/join");
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

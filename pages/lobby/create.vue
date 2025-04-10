<template>
  <div
    class="min-h-screen flex items-center justify-center bg-slate-800 text-white"
  >
    <button
      class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-sm"
      @click="create"
    >
      Create Lobby
    </button>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import { useRouter } from "vue-router";

definePageMeta({
  middleware: ["auth"],
});

const userStore = useUserStore();
const { createLobby } = useLobby();
const router = useRouter();

const create = async () => {
  if (!userStore.session) await userStore.fetchUserSession();

  try {
    console.log("Creating lobby for user:", userStore.user?.$id);
    const lobby = await createLobby(userStore.user?.$id!);
    console.log("Lobby created:", lobby);
    await router.push(`/lobby/${lobby.code}`);
  } catch (err) {
    console.error("Lobby creation failed:", err);
  }
};
</script>

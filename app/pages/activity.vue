<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-4">
    <div class="text-center">
      <h2 class="text-2xl font-bold mb-2">{{ statusText }}</h2>
      <p v-if="error" class="text-red-500 mt-2">{{ error }}</p>
      <p v-if="error" class="text-sm text-gray-400 mt-4">
        <button class="underline" @click="retry">Try again</button>
      </p>
      <div
        v-if="!error"
        class="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mt-4"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";

definePageMeta({ layout: "activity" });

const router = useRouter();
const userStore = useUserStore();
const { createLobby, getActiveLobbyForUser } = useLobby();
const { init, authenticate } = useDiscordSDK();

const statusText = ref("Connecting to Discord...");
const error = ref<string | null>(null);

async function launch() {
  error.value = null;

  try {
    // 1. Initialize Discord SDK
    statusText.value = "Connecting to Discord...";
    await init();

    // 2. Authenticate (Discord → Appwrite session)
    statusText.value = "Signing you in...";
    const authData = await authenticate();

    // 3. Create Appwrite session on the client (skip if already logged in from prior attempt)
    if (!userStore.isLoggedIn) {
      const { account } = useAppwrite();
      await account.createSession({
        userId: authData.userId,
        secret: authData.secret,
      });

      // 4. Hydrate user store
      await userStore.fetchUserSession();

      if (!userStore.user) {
        throw new Error("Failed to establish session");
      }
    }

    // 5. Check for existing active lobby
    statusText.value = "Setting up your game...";
    const existingLobby = await getActiveLobbyForUser(userStore.user.$id);

    if (existingLobby) {
      statusText.value = "Rejoining your game...";
      await router.replace(`/game/${existingLobby.code}`);
      return;
    }

    // 6. Create new lobby
    const displayName = `${authData.discordUser.username}'s Game`;
    const lobby = await createLobby(userStore.user.$id, displayName);
    statusText.value = "Game created! Joining...";
    await router.replace(`/game/${lobby.code}`);
  } catch (err: any) {
    console.error("[Discord Activity] Launch failed:", err);
    error.value = err?.message || "Something went wrong. Please try again.";
    statusText.value = "Launch failed";
  }
}

function retry() {
  launch();
}

onMounted(() => {
  launch();
});
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-4">
    <img src="/img/ufp2.svg" alt="Unfit For Print" class="w-32 h-auto" />

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
const { init, authenticate, getSdk } = useDiscordSDK();
const { createLobby, joinLobby, getLobbyByInstanceId } = useLobby();

const statusText = ref("Connecting to Discord...");
const error = ref<string | null>(null);

async function launch() {
  error.value = null;

  try {
    // 1. Initialize Discord SDK
    statusText.value = "Connecting to Discord...";
    const sdk = await init();

    // 2. Authenticate (Discord → Appwrite session)
    statusText.value = "Logging you in...";
    const authData = await authenticate();

    // 3. Create Appwrite session on the client
    if (!userStore.isLoggedIn) {
      const { account } = useAppwrite();
      await account.createSession({
        userId: authData.userId,
        secret: authData.secret,
      });
      await userStore.fetchUserSession();

      if (!userStore.user) {
        throw new Error("Failed to establish session");
      }
    }

    // 4. Find or create lobby for this Activity instance
    statusText.value = "Joining game...";
    const instanceId = sdk.instanceId;
    if (!instanceId) {
      throw new Error("No Activity instance ID available");
    }

    let lobby = await getLobbyByInstanceId(instanceId);

    if (lobby) {
      // Lobby exists for this Activity — join it
      await joinLobby(lobby.code, {
        username: userStore.user?.name ?? "Unknown",
      });
    } else {
      // No lobby yet — create one as host
      try {
        lobby = await createLobby(
          authData.userId,
          `${userStore.user?.name ?? "Unknown"}'s Game`,
          false,
          undefined,
          instanceId,
        );
      } catch (err: unknown) {
        // Race condition: another user may have created the lobby first
        // Re-check before giving up
        lobby = await getLobbyByInstanceId(instanceId);
        if (lobby) {
          await joinLobby(lobby.code, {
            username: userStore.user?.name ?? "Unknown",
          });
        } else {
          throw err;
        }
      }
    }

    if (!lobby) {
      throw new Error("Failed to create or find lobby");
    }

    // 5. Navigate to game
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

<template>
  <div class="relative flex flex-col items-center justify-center h-screen gap-4">
    <ScrollingBackground :gap="12" :scale="0.5" :speedPx="15" />
    <img src="/img/ufp2.svg" alt="Unfit For Print" class="relative z-10 w-32 h-auto" />

    <div class="relative z-10 text-center">
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

definePageMeta({ layout: "game" });

const router = useRouter();
const userStore = useUserStore();
const {
  init,
  authenticate,
  getSdk,
  getChannelParticipants,
  subscribeToParticipants,
  subscribeToSpeaking,
} = useDiscordSDK();
const { joinLobby, getLobbyByInstanceId } = useLobby();

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

    // 3. Establish Appwrite session on the client
    if (!userStore.isLoggedIn) {
      const { client } = useAppwrite();
      client.setSession(authData.secret);
      await userStore.fetchUserSession();

      if (!userStore.user) {
        throw new Error("Failed to establish session");
      }
    }

    // 4. Fetch VC participants and subscribe to updates
    statusText.value = "Loading voice channel...";
    await getChannelParticipants();
    await subscribeToParticipants();
    await subscribeToSpeaking();

    // 5. Fast-path: reconnect to existing lobby for this Activity instance
    const instanceId = sdk.instanceId;
    if (instanceId) {
      const lobby = await getLobbyByInstanceId(instanceId);
      if (lobby) {
        await joinLobby(lobby.code, {
          username: userStore.user?.name ?? "Unknown",
        });
        await router.replace(`/game/${lobby.code}`);
        return;
      }
    }

    // 6. No existing lobby — go to VC Hub
    await router.replace("/activity/hub");
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

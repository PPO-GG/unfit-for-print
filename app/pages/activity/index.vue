<template>
  <div class="activity-launch">
    <ScrollingBackground :gap="12" :scale="0.5" :speedPx="15" />

    <div class="activity-launch__content">
      <img src="/img/ufp2.svg" alt="Unfit For Print" class="activity-launch__logo" />

      <!-- Loading state -->
      <template v-if="!launchError">
        <h2 class="activity-launch__status">{{ statusText }}</h2>
        <div class="activity-launch__spinner" />
      </template>

      <!-- Error state -->
      <template v-else>
        <div class="activity-launch__error-card">
          <div class="activity-launch__error-icon">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8" />
          </div>

          <h2 class="activity-launch__error-title">{{ launchError.title }}</h2>
          <p class="activity-launch__error-message">{{ launchError.message }}</p>

          <div v-if="launchError.tips.length" class="activity-launch__tips">
            <p class="activity-launch__tips-label">Things to try:</p>
            <ul class="activity-launch__tips-list">
              <li v-for="(tip, i) in launchError.tips" :key="i">{{ tip }}</li>
            </ul>
          </div>

          <button class="activity-launch__retry" @click="retry">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
            Try Again
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";

definePageMeta({ layout: "game" });

// ─── Launch Error Types ──────────────────────────────────────────────────────

interface LaunchError {
  title: string;
  message: string;
  tips: string[];
}

type LaunchStage = "sdk" | "auth" | "backend" | "session" | "voice" | "lobby";

function buildLaunchError(stage: LaunchStage, raw?: string): LaunchError {
  switch (stage) {
    case "sdk":
      return {
        title: "Couldn\u2019t connect to Discord",
        message: "The game was unable to establish a connection with Discord.",
        tips: [
          "Close and reopen the Activity",
          "Restart Discord completely (check your system tray)",
          "Clear Discord cache: Settings \u2192 Advanced \u2192 Clear Cache",
          "Disable any VPN or proxy and try again",
          "Try from a different device or the Discord web app",
        ],
      };
    case "auth":
      return {
        title: "Authorization required",
        message:
          "The game needs permission to access your Discord account. "
          + "Please accept the permissions prompt when it appears.",
        tips: [
          "When prompted, click \u201CAuthorize\u201D to grant access",
          "If no prompt appeared, close the Activity and relaunch it",
          "Make sure pop-ups are not blocked by your browser",
        ],
      };
    case "backend":
      return {
        title: "Server error",
        message:
          raw && raw.includes("token")
            ? "The login handshake with our server failed. This is usually temporary."
            : "Something went wrong on our end while setting up your session.",
        tips: [
          "Wait a moment and tap \u201CTry Again\u201D",
          "If this keeps happening, the game server may be under maintenance",
        ],
      };
    case "session":
      return {
        title: "Account setup failed",
        message: "We were able to verify your Discord account, but couldn\u2019t finish setting up your game profile.",
        tips: [
          "Tap \u201CTry Again\u201D \u2014 this usually resolves itself",
          "Try closing and relaunching the Activity",
        ],
      };
    case "voice":
      return {
        title: "Voice channel not accessible",
        message: "The game couldn\u2019t load voice channel information. You may have launched the Activity outside of a voice channel.",
        tips: [
          "Make sure you\u2019re in a voice channel before launching",
          "Try leaving and rejoining the voice channel",
          "Close the Activity and start it again from the voice channel",
        ],
      };
    case "lobby":
      return {
        title: "Couldn\u2019t rejoin lobby",
        message: "There was a problem reconnecting you to an existing game session.",
        tips: [
          "Tap \u201CTry Again\u201D to retry",
          "If the game already ended, a new lobby will be created",
        ],
      };
    default:
      return {
        title: "Something went wrong",
        message: raw || "An unexpected error occurred.",
        tips: [
          "Close the Activity and relaunch it",
          "Restart Discord if the problem persists",
        ],
      };
  }
}

// ─── State ───────────────────────────────────────────────────────────────────

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
const launchError = ref<LaunchError | null>(null);

// ─── Launch Flow ─────────────────────────────────────────────────────────────

async function launch() {
  launchError.value = null;
  let stage: LaunchStage = "sdk";

  try {
    // 1. Initialize Discord SDK
    statusText.value = "Connecting to Discord...";
    stage = "sdk";
    const sdk = await init();

    // 2. Authenticate (Discord → Appwrite session)
    statusText.value = "Logging you in...";
    stage = "auth";
    let authData;
    try {
      authData = await authenticate();
    } catch (authErr: any) {
      // Distinguish consent-denied from backend errors
      const msg = authErr?.message?.toLowerCase?.() ?? "";
      if (msg.includes("authorize") || msg.includes("consent") || msg.includes("denied") || msg.includes("cancel")) {
        stage = "auth";
      } else {
        stage = "backend";
      }
      throw authErr;
    }

    // 3. Establish Appwrite session on the client
    statusText.value = "Setting up your profile...";
    stage = "session";
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
    stage = "voice";
    await getChannelParticipants();
    await subscribeToParticipants();
    await subscribeToSpeaking();

    // 5. Fast-path: reconnect to existing lobby for this Activity instance
    stage = "lobby";
    const instanceId = sdk.instanceId;
    if (instanceId) {
      const lobby = await getLobbyByInstanceId(instanceId);
      if (lobby) {
        statusText.value = "Rejoining game...";
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
    console.error(`[Discord Activity] Launch failed at stage "${stage}":`, err);
    launchError.value = buildLaunchError(stage, err?.message);
  }
}

function retry() {
  launch();
}

onMounted(() => {
  launch();
});
</script>

<style scoped>
.activity-launch {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  height: 100dvh;
  gap: 1rem;
}

.activity-launch__content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
  padding: 0 1rem;
}

.activity-launch__logo {
  width: 8rem;
  height: auto;
  margin-bottom: 1.5rem;
}

.activity-launch__status {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--ui-text);
}

.activity-launch__spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--ui-primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-top: 1rem;
}

/* ── Error Card ────────────────────────────────────────────────────────────── */

.activity-launch__error-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1rem;
  padding: 1.75rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.activity-launch__error-icon {
  color: #f87171;
  margin-bottom: 0.25rem;
}

.activity-launch__error-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ui-text);
}

.activity-launch__error-message {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
  line-height: 1.5;
}

.activity-launch__tips {
  width: 100%;
  margin-top: 0.5rem;
  text-align: left;
}

.activity-launch__tips-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ui-text-dimmed);
  margin-bottom: 0.5rem;
}

.activity-launch__tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.activity-launch__tips-list li {
  font-size: 0.8125rem;
  color: var(--ui-text-muted);
  padding-left: 1.25rem;
  position: relative;
  line-height: 1.4;
}

.activity-launch__tips-list li::before {
  content: "\2022";
  position: absolute;
  left: 0.25rem;
  color: var(--ui-primary);
}

/* ── Retry Button ──────────────────────────────────────────────────────────── */

.activity-launch__retry {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.6rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ui-text);
  background: var(--ui-primary);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
}

.activity-launch__retry:hover {
  opacity: 0.9;
}

.activity-launch__retry:active {
  transform: scale(0.97);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

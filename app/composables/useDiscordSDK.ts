import { ref, readonly } from "vue";
import { DiscordSDK } from "@discord/embedded-app-sdk";

let sdkInstance: DiscordSDK | null = null;

const isDiscordActivity = ref(false);
const isReady = ref(false);
const isAuthenticated = ref(false);
const discordUser = ref<{
  id: string;
  username: string;
  avatar: string | null;
  avatarUrl: string | null;
} | null>(null);

// Synchronous detection: Discord's iframe sets these query params
if (import.meta.client) {
  const params = new URLSearchParams(window.location.search);
  if (params.has("frame_id") && params.has("instance_id")) {
    isDiscordActivity.value = true;
  }
}

export function useDiscordSDK() {
  const config = useRuntimeConfig();

  async function init(): Promise<DiscordSDK> {
    if (sdkInstance) return sdkInstance;

    const clientId = config.public.discordClientId as string;
    if (!clientId) {
      throw new Error("Discord client ID not configured");
    }

    sdkInstance = new DiscordSDK(clientId);
    await sdkInstance.ready();
    isReady.value = true;
    isDiscordActivity.value = true;

    return sdkInstance;
  }

  async function authenticate(): Promise<{
    userId: string;
    secret: string;
    discordUser: { id: string; username: string; avatar: string | null; avatarUrl: string | null };
  }> {
    if (!sdkInstance) {
      throw new Error("Discord SDK not initialized. Call init() first.");
    }

    const clientId = config.public.discordClientId as string;

    // Step 1: Get authorization code from Discord
    const { code } = await sdkInstance.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify"],
    });

    // Step 2: Exchange code for tokens via our backend
    const authData = await $fetch("/api/auth/discord-activity", {
      method: "POST",
      body: { code },
    });

    // Step 3: Complete Discord SDK authentication
    await sdkInstance.commands.authenticate({
      access_token: authData.accessToken,
    });

    isAuthenticated.value = true;
    discordUser.value = authData.discordUser;

    return {
      userId: authData.userId,
      secret: authData.secret,
      discordUser: authData.discordUser,
    };
  }

  function getSdk(): DiscordSDK | null {
    return sdkInstance;
  }

  return {
    isDiscordActivity: readonly(isDiscordActivity),
    isReady: readonly(isReady),
    isAuthenticated: readonly(isAuthenticated),
    discordUser: readonly(discordUser),
    init,
    authenticate,
    getSdk,
  };
}

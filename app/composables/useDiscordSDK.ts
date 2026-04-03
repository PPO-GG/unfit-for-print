import { ref, readonly } from "vue";

let sdkInstance: any = null;
let cachedAuthResult: {
  userId: string;
  secret: string;
  discordUser: { id: string; username: string; avatar: string | null; avatarUrl: string | null };
} | null = null;

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

  async function init(): Promise<any> {
    if (sdkInstance) return sdkInstance;

    const clientId = config.public.discordClientId as string;
    if (!clientId) {
      throw new Error("Discord client ID not configured");
    }

    const { DiscordSDK } = await import("@discord/embedded-app-sdk");
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
    // If already authenticated, return cached result
    if (isAuthenticated.value && cachedAuthResult) {
      return cachedAuthResult;
    }

    if (!sdkInstance) {
      throw new Error("Discord SDK not initialized. Call init() first.");
    }

    const clientId = config.public.discordClientId as string;

    // Step 1: Get authorization code from Discord
    // Try silent auth first; fall back to consent dialog (needed for DMs
    // where the user hasn't individually authorized the app yet)
    let code: string;
    try {
      ({ code } = await sdkInstance.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify"],
      }));
    } catch {
      ({ code } = await sdkInstance.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        scope: ["identify"],
      }));
    }

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

    cachedAuthResult = {
      userId: authData.userId,
      secret: authData.secret,
      discordUser: authData.discordUser,
    };

    return cachedAuthResult;
  }

  async function inviteFriends() {
    if (!sdkInstance) throw new Error("Discord SDK not initialized");
    await sdkInstance.commands.openInviteDialog();
  }

  function close() {
    console.log("[Discord SDK] close() called, sdkInstance:", !!sdkInstance);
    if (!sdkInstance) {
      console.warn("[Discord SDK] Cannot close — SDK not initialized");
      return;
    }
    sdkInstance.close(1000, "User closed activity");
  }

  function getSdk(): any | null {
    return sdkInstance;
  }

  return {
    isDiscordActivity: readonly(isDiscordActivity),
    isReady: readonly(isReady),
    isAuthenticated: readonly(isAuthenticated),
    discordUser: readonly(discordUser),
    init,
    authenticate,
    inviteFriends,
    close,
    getSdk,
  };
}

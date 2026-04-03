// plugins/initUser.client.ts
import { useUserStore } from "~/stores/userStore";

export default defineNuxtPlugin(() => {
  const userStore = useUserStore();

  // Discord Activity handles its own auth flow in activity.vue
  const { isDiscordActivity } = useDiscordSDK();
  if (isDiscordActivity.value) return;

  // Skip if already verified (e.g. after OAuth callback redirect)
  if (
    typeof window !== "undefined" &&
    (window as any).__auth_verified &&
    userStore.isLoggedIn
  ) {
    return;
  }

  if (!userStore.isLoggedIn) {
    void userStore.fetchUserSession().catch((error) => {
      console.error("Failed to fetch user session:", error);
    });
  }
});

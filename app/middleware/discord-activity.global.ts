// middleware/discord-activity.global.ts
// Handles routing for Discord Activity sessions.
// Activity users can navigate freely — the only redirect is skipping the
// /activity init page when the user is already authenticated.
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return;

  const { isDiscordActivity, isAuthenticated } = useDiscordSDK();

  if (!isDiscordActivity.value) return;

  // Skip the auth/init flow if already authenticated — go straight to hub
  if (to.path === "/activity" && isAuthenticated.value) {
    return navigateTo("/activity/hub", { replace: true });
  }
});

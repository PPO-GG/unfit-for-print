// middleware/discord-activity.global.ts
// Handles routing for Discord Activity sessions.
// Ensures the Discord SDK init/auth flow runs before any other page.
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return;

  const { isDiscordActivity, isAuthenticated } = useDiscordSDK();

  if (!isDiscordActivity.value) return;

  // Already authenticated — skip the init page if navigating there
  if (to.path === "/activity" && isAuthenticated.value) {
    return navigateTo("/activity/hub", { replace: true });
  }

  // Not authenticated and not already on an /activity route — redirect to init flow
  if (!isAuthenticated.value && !to.path.startsWith("/activity")) {
    return navigateTo("/activity", { replace: true });
  }
});

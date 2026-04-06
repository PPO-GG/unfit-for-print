// middleware/discord-activity.global.ts
// Keep Discord Activity users within the Activity flow.
// Allowed routes: /activity (auth), /activity/hub (VC Hub), /game/* (gameplay)
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return;

  const { isDiscordActivity, isAuthenticated } = useDiscordSDK();

  // Dev mode: allow direct access to Activity pages
  if (!isDiscordActivity.value) {
    if (import.meta.dev) return;
    return;
  }

  const allowed =
    to.path === "/activity" ||
    to.path === "/activity/hub" ||
    to.path.startsWith("/game/");

  if (!allowed) {
    // If already authenticated, go to hub. Otherwise, go to auth flow.
    const target = isAuthenticated.value ? "/activity/hub" : "/activity";
    return navigateTo({ path: target, query: to.query }, { replace: true });
  }
});

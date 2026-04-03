// middleware/discord-activity.global.ts
// Redirect Discord Activity users to /activity (Discord opens the root URL)
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return;

  const { isDiscordActivity } = useDiscordSDK();
  if (
    isDiscordActivity.value &&
    to.path !== "/activity" &&
    !to.path.startsWith("/game/")
  ) {
    return navigateTo({ path: "/activity", query: to.query }, { replace: true });
  }
});

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  if (url.pathname.startsWith("/activity") || url.pathname.startsWith("/game/")) {
    setResponseHeader(
      event,
      "Content-Security-Policy",
      "frame-ancestors 'self' https://discord.com https://*.discord.com",
    );
  }
});

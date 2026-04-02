export default defineEventHandler((event) => {
  setResponseHeader(
    event,
    "Content-Security-Policy",
    "frame-ancestors 'self' https://discord.com https://*.discord.com",
  );
});

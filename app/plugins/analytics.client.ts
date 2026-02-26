import { defineNuxtPlugin } from "#app";

// Analytics plugin — Rybbit analytics is currently disabled.
// This plugin provides a no-op $analytics interface so existing
// callers don't break if they reference it.
export default defineNuxtPlugin(() => {
  const analytics = {
    trackEvent: (_name: string, _props: Record<string, any> = {}) => {},
    trackPageview: () => {},
    setUserId: (_id: string) => {},
    clearUserId: () => {},
  };

  return {
    provide: {
      analytics,
    },
  };
});

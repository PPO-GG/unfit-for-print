import { ref } from "vue";

const activityToken = ref<string | null>(null);

export function isActivityApiRequest(
  request: string | Request | URL,
  baseURL?: string,
  origin = globalThis.location?.origin,
): boolean {
  if (!origin) return false;

  const target = typeof request === "string" || request instanceof URL
    ? request.toString()
    : request.url;

  try {
    const effectiveURL = new URL(target, baseURL ? new URL(baseURL, origin) : origin);
    return effectiveURL.origin === origin && effectiveURL.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export function getActivityUserId(): string | null {
  const payload = activityToken.value?.split(".")[0];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const { userId } = JSON.parse(atob(padded));
    return typeof userId === "string" ? userId : null;
  } catch {
    return null;
  }
}

export function useAuthHeaders() {
  function setActivityToken(token: string) {
    activityToken.value = token;
  }

  function authHeaders(): Record<string, string> {
    return activityToken.value
      ? { Authorization: `Bearer ${activityToken.value}` }
      : {};
  }

  return { setActivityToken, authHeaders };
}

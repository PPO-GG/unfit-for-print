import { ref } from "vue";

const activityToken = ref<string | null>(null);

export function isActivityApiRequest(request: string | Request | URL): boolean {
  return typeof request === "string" && request.startsWith("/api/");
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

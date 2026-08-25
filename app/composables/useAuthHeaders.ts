import { ref } from "vue";

const activityToken = ref<string | null>(null);

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

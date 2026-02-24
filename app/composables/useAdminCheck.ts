// composables/useAdminCheck.ts
import { useUserStore } from "~/stores/userStore";
import { ref, watch } from "vue";

/**
 * Checks if the current user is an admin by checking their Appwrite labels.
 *
 * Admin access is granted by assigning the "admin" label to a user in
 * the Appwrite console (Users → select user → Labels).
 * No team membership or env var required — the label is part of the user
 * object already loaded in the store.
 *
 * Safe for anonymous users — will return false.
 */
export const useAdminCheck = (): boolean => {
  const userStore = useUserStore();
  const user = userStore.user;

  if (!user) return false;

  // Labels come back as a string[] on the Appwrite user object
  return (
    Array.isArray((user as any).labels) &&
    (user as any).labels.includes("admin")
  );
};

/**
 * Returns a reactive ref for admin state — for use in templates.
 * Re-evaluates whenever the user session changes.
 */
export const useIsAdmin = () => {
  const userStore = useUserStore();
  const isAdmin = ref(useAdminCheck());

  // Re-check whenever the user object changes (login/logout/label change)
  watch(
    () => userStore.user,
    () => {
      isAdmin.value = useAdminCheck();
    },
    { immediate: true },
  );

  return isAdmin;
};

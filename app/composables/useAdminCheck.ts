// composables/useAdminCheck.ts
import { useUserStore } from "~/stores/userStore";
import { ref, watch } from "vue";

/**
 * Checks if the current user is an admin, via the `isAdmin` flag on the
 * flat AuthUser object (backed by the `users.isAdmin` Postgres column).
 *
 * Safe for anonymous/guest users — will return false.
 */
export const useAdminCheck = (): boolean => {
  const userStore = useUserStore();
  return !!userStore.user?.isAdmin;
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

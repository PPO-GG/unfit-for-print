import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import { useNotifications } from "~/composables/useNotifications";

/**
 * Encapsulates the "check for an active lobby, then redirect or open a modal"
 * flow used by the header and any page-level CTA that needs Join/Create actions.
 *
 * Each call to useLobbyActions() gets its own reactive state so multiple
 * consumers (e.g. AppHeader + about.vue) are fully independent.
 */
export function useLobbyActions() {
  const { getActiveLobbyForUser, createLobby } = useLobby();
  const router = useRouter();
  const userStore = useUserStore();
  const { notify } = useNotifications();
  const { t } = useI18n();

  const isJoining = ref(false);
  const isCreating = ref(false);
  const showJoin = ref(false);

  const checkForActiveLobbyAndJoin = async (): Promise<void> => {
    try {
      isJoining.value = true;

      if (userStore.user) {
        const activeLobby = await getActiveLobbyForUser(userStore.user.$id);
        if (activeLobby) {
          notify({
            title: t("notification.redirecting"),
            color: "info",
            icon: "i-mdi-controller",
            duration: 2000,
          });
          await router.push(`/game/${activeLobby.code}`);
          return;
        }
      }

      showJoin.value = true;
    } catch (error: unknown) {
      console.error("Error checking for active lobby:", error);
      showJoin.value = true;
    } finally {
      isJoining.value = false;
    }
  };

  const checkForActiveLobbyAndCreate = async (): Promise<void> => {
    if (!userStore.user?.$id) return;
    try {
      isCreating.value = true;

      const activeLobby = await getActiveLobbyForUser(userStore.user.$id);
      if (activeLobby) {
        notify({
          title: t("notification.redirecting"),
          color: "info",
          icon: "i-mdi-controller",
          duration: 2000,
        });
        await router.push(`/game/${activeLobby.code}`);
        return;
      }

      const lobby = await createLobby(userStore.user.$id);
      if (!lobby?.code) throw new Error("Invalid lobby response");
      await router.push(`/game/${lobby.code}?creator=true`);
    } catch (error: unknown) {
      console.error("Error creating lobby:", error);
      notify({
        title: t("modal.error_create_lobby"),
        description: error instanceof Error ? error.message : "Unknown error",
        color: "error",
      });
    } finally {
      isCreating.value = false;
    }
  };

  /**
   * Called by JoinLobbyForm / CreateLobbyDialog after a successful join or
   * create. Navigates to the game page with the creator flag set so the game
   * page skips the "are you in this lobby?" check while the player document
   * is still being written.
   */
  const handleJoined = (code: string): void => {
    notify({
      title: t("notification.loading_game"),
      color: "info",
      icon: "i-mdi-loading i-spin",
      duration: 3000,
    });
    router.push(`/game/${code}?creator=true`);
  };

  return {
    isJoining,
    isCreating,
    showJoin,
    checkForActiveLobbyAndJoin,
    checkForActiveLobbyAndCreate,
    handleJoined,
  };
}

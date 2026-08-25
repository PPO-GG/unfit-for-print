// composables/useJoinLobby.ts
import { useRouter } from "vue-router";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import { useProfanityFilter } from "~/composables/useProfanityFilter";
import { getAppwrite } from "~/utils/appwrite";

export const useJoinLobby = () => {
  const router = useRouter();
  const { t } = useI18n();
  const { getLobbyByCode, isInLobby, joinLobby, getActiveLobbyForUser } =
    useLobby();
  const userStore = useUserStore();
  const { isBadUsername } = useProfanityFilter();

  const initSessionIfNeeded = async () => {
    if (import.meta.server) return;
    if (userStore.isActivitySession) return;
    const { account } = getAppwrite();
    await userStore.fetchUserSession();
    if (!userStore.session) {
      await account.createAnonymousSession();
      await userStore.fetchUserSession();
    }
  };

  const initializeGamePageSession = async () => {
    await initSessionIfNeeded();
    if (!userStore.isActivitySession) {
      await userStore.fetchUserSession();
    }
  };

  const validateUsername = (username: string): string | null => {
    if (!username.trim()) return t("lobby.missing_username");
    if (isBadUsername(username)) return t("lobby.name_not_allowed");
    return null;
  };

  /**
   * Join a lobby (anonymous or authenticated) and store your membership doc ID
   * Returns true on success, false on error
   */
  const joinLobbyWithSession = async (
    username: string,
    lobbyCode: string,
    setError?: (message: string) => void,
    setJoining?: (state: boolean) => void,
  ): Promise<boolean> => {
    try {
      setError?.("");
      setJoining?.(true);

      // Bootstrap a guest session transparently if the user has no
      // session yet — replaces the old separate initSessionIfNeeded pass
      // (which used Appwrite's createAnonymousSession) for the join flow
      // specifically, since we already have the username here.
      if (!userStore.isLoggedIn) {
        await userStore.loginAsGuest(username);
      }

      const user = userStore.user!;
      if (!user) new Error("No user session");

      const errorMsg = validateUsername(username);
      if (errorMsg) {
        setError?.(errorMsg);
        return false;
      }

      const code = lobbyCode.trim().toUpperCase();
      const lobby = await getLobbyByCode(code);
      if (!lobby) {
        setError?.("Lobby not found.");
        return false;
      }

      // If user is already in the lobby, redirect directly
      if (await isInLobby(user.$id, lobby.id)) {
        await router.push(`/game/${lobby.code}`);
        return true;
      }

      // Perform join: creates the players row. Name-uniqueness is no
      // longer pre-checked client-side (that required a direct Appwrite
      // query against the players collection); /api/lobby/join currently
      // allows duplicate names within a lobby.
      const result = await joinLobby(code, { username });

      // Capture your newly created player row's id
      if (result.player) userStore.playerDocId = result.player.id;

      // Navigate into the game
      await router.push(`/game/${lobby.code}`);
      return true;
    } catch (err: any) {
      console.error("Join error:", err);
      setError?.(err.message || "Something went wrong while joining.");
    } finally {
      setJoining?.(false);
    }
    return false;
  };

  const checkJoinAccess = async (lobbyCode: string, onFail: () => void) => {
    await initSessionIfNeeded();
    const user = userStore.user;
    if (!user) return onFail();
    const activeLobby = await getActiveLobbyForUser(user.$id);
    if (!activeLobby || activeLobby.code !== lobbyCode) return onFail();
    return true;
  };

  const autoRedirectIfActive = async () => {
    await initSessionIfNeeded();
    const userId = userStore.user?.$id;
    if (!userId) return;
    const activeLobby = await getActiveLobbyForUser(userId);
    if (activeLobby) {
      await router.replace(`/game/${activeLobby.code}`);
    }
  };

  return {
    joinLobbyWithSession,
    autoRedirectIfActive,
    initSessionIfNeeded,
    initializeGamePageSession,
    validateUsername,
    checkJoinAccess,
  };
};

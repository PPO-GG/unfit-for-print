// composables/useJoinLobby.ts
import { useRouter } from "vue-router";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import { useProfanityFilter } from "~/composables/useProfanityFilter";
import { getAppwrite } from "~/utils/appwrite";
import { ID, Query } from "appwrite";

export const useJoinLobby = () => {
  const router = useRouter();
  const { t } = useI18n();
  const { getLobbyByCode, isInLobby, joinLobby, getActiveLobbyForUser } =
    useLobby();
  const userStore = useUserStore();
  const { isBadUsername } = useProfanityFilter();

  const initSessionIfNeeded = async () => {
    if (import.meta.server) return;
    const { account } = getAppwrite();
    await userStore.fetchUserSession();
    if (!userStore.session) {
      await account.createAnonymousSession();
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

      await initSessionIfNeeded();
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
      if (await isInLobby(user.$id, lobby.$id)) {
        await router.push(`/game/${lobby.code}`);
        return true;
      }

      // Check if the chosen username is already taken in this lobby
      const { databases } = getAppwrite();
      const config = useRuntimeConfig();
      const existingPlayers = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        config.public.appwritePlayerCollectionId,
        [Query.equal("lobbyId", lobby.$id), Query.limit(100)],
      );
      const nameTaken = existingPlayers.documents.some(
        (doc: Record<string, any>) =>
          doc.name?.toLowerCase() === username.trim().toLowerCase(),
      );
      if (nameTaken) {
        setError?.(t("lobby.username_taken"));
        return false;
      }

      // Perform join: creates the players doc
      await joinLobby(code, { username });

      // Fetch *your* newly created players-doc to capture its $id
      const res = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        config.public.appwritePlayerCollectionId,
        [
          Query.equal("userId", user.$id),
          Query.equal("lobbyId", lobby.$id),
          Query.limit(1),
        ],
      );
      const myDoc = res.documents[0];
      userStore.playerDocId = myDoc.$id;

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
    validateUsername,
    checkJoinAccess,
  };
};

import { ID, Permission, Role, Query } from "appwrite";
import type { Models } from "appwrite";
import { useAppwrite } from "~/composables/useAppwrite";
import { useGameState } from "~/composables/useGameState";
import { useUserStore } from "~/stores/userStore";
import { isAnonymousUser } from "~/composables/useUserUtils";
import type {Lobby} from "~/types/lobby";

export const useLobby = () => {
  const getAppwrite = () => {
    if (import.meta.server) throw new Error("useLobby() cannot be used during SSR");
    const { databases, account, client } = useAppwrite();
    if (!databases || !account) throw new Error("Appwrite not initialized");
    return { databases, account, client };
  };

  const getConfig = () => useRuntimeConfig();
  const userStore = useUserStore();
  const { encodeGameState, decodeGameState } = useGameState();

  const toPlainLobby = (doc: any): Lobby => ({ ...doc } as Lobby);

  const createLobby = async (hostUserId: string) => {
    const { databases } = getAppwrite();
    const config = getConfig();
    const lobbyCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const data = {
      hostUserId,
      code: lobbyCode,
      status: "waiting",
      round: 0,
      gameState: encodeGameState({
        phase: "waiting",
        round: 0,
        activePlayer: null,
        board: [],
        scores: {},
      }),
    };

    const permissions = [
      Permission.read(Role.any()),
      Permission.update(Role.user(hostUserId)),
      Permission.delete(Role.user(hostUserId)),
    ];

    const lobby = await databases.createDocument(
        config.public.appwriteDatabaseId,
        "lobby",
        ID.unique(),
        data,
        permissions
    );

    await joinLobby(lobby.code, {
      username: userStore.user?.name ?? "Anonymous",
      isHost: true,
    });

    return { ...lobby };
  };

  const getLobbyByCode = async (code: string) => {
    const { databases } = getAppwrite();
    const config = getConfig();
    const result = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        "lobby",
        [Query.equal("code", code), Query.limit(1)]
    );
    return result.documents[0] ? { ...result.documents[0] } : null;
  };

  const getActiveLobbyForUser = async (userId: string) => {
    const { databases } = getAppwrite();
    const config = getConfig();
    const res = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        "players",
        [Query.equal("userId", userId)]
    );
    if (res.total === 0) return null;
    const playerDoc = res.documents[0];
    const lobby = await databases.getDocument(
        config.public.appwriteDatabaseId,
        "lobby",
        playerDoc.lobbyId
    );
    if (lobby.status === "complete") return null;
    return { ...lobby };
  };

  const getPlayersForLobby = async (lobbyId: string) => {
    const { databases } = getAppwrite();
    const config = getConfig();
    const res = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        "players",
        [Query.equal("lobbyId", lobbyId)]
    );
    return res.documents;
  };

  const isInLobby = async (userId: string, lobbyId: string) => {
    const { databases } = getAppwrite();
    const config = getConfig();
    const res = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        "players",
        [Query.equal("userId", userId), Query.equal("lobbyId", lobbyId), Query.limit(1)]
    );
    return res.total > 0;
  };

  const joinLobby = async (
      code: string,
      options?: { username?: string; isHost?: boolean; skipSession?: boolean }
  ) => {
    const { databases, account } = getAppwrite();
    const config = getConfig();
    if (!userStore.session && !options?.skipSession) {
      await account.createAnonymousSession();
    }
    const user = await account.get();
    const username = options?.username ?? user.prefs?.name ?? "Unknown";
    const session = await account.getSession("current");
    const lobby = await getLobbyByCode(code);
    if (!lobby) throw new Error("Lobby not found");

    await account.updatePrefs({ name: username });
    await userStore.fetchUserSession();
    await createPlayerIfNeeded(user, session, lobby.$id, username, !!options?.isHost);

    if (session.provider !== "anonymous") {
      const state = decodeGameState(lobby.gameState);
      state.players ??= {};
      state.players[user.$id] = username;

      await databases.updateDocument(
          config.public.appwriteDatabaseId,
          "lobby",
          lobby.$id,
          { gameState: encodeGameState(state) }
      );
    }

    return { ...lobby };
  };

  const createPlayerIfNeeded = async (
      user: Models.User<Models.Preferences>,
      session: Models.Session,
      lobbyId: string,
      username: string,
      isHost: boolean
  ) => {
    const { databases } = getAppwrite();
    const config = getConfig();
    const existing = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        "players",
        [Query.equal("userId", user.$id), Query.equal("lobbyId", lobbyId), Query.limit(1)]
    );
    if (existing.total > 0) return;

    const permissions = isAnonymousUser(user)
        ? ['read("any")', 'update("users")', 'delete("users")']
        : [`read("any")`, `update("user:${user.$id}")`, `delete("user:${user.$id}")`];

    await databases.createDocument(
        config.public.appwriteDatabaseId,
        "players",
        ID.unique(),
        {
          userId: user.$id,
          lobbyId,
          name: username,
          avatar: user.prefs?.avatar ?? "",
          isHost,
          joinedAt: new Date().toISOString(),
          provider: session.provider,
        },
        permissions
    );
  };

  const leaveLobby = async (lobbyId: string, userId: string) => {
    const { databases } = getAppwrite();
    const config = getConfig();
    const lobby = await databases.getDocument(
        config.public.appwriteDatabaseId,
        "lobby",
        lobbyId
    );

    const res = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        "players",
        [Query.equal("userId", userId), Query.equal("lobbyId", lobbyId), Query.limit(1)]
    );

    if (res.total > 0) {
      await databases.deleteDocument(
          config.public.appwriteDatabaseId,
          "players",
          res.documents[0].$id
      );
    }

    if (lobby.hostUserId === userId) {
      const remaining = await getPlayersForLobby(lobbyId);
      if (remaining.length === 0 || remaining.every((p) => p.provider === "anonymous")) {
        for (const player of remaining) {
          await databases.deleteDocument(
              config.public.appwriteDatabaseId,
              "players",
              player.$id
          );
        }
        await databases.deleteDocument(
            config.public.appwriteDatabaseId,
            "lobby",
            lobbyId
        );
        return;
      }
      const newHost = remaining.find((p) => p.provider !== "anonymous");
      if (newHost) {
        await databases.updateDocument(
            config.public.appwriteDatabaseId,
            "lobby",
            lobbyId,
            { hostUserId: newHost.userId }
        );
        await databases.updateDocument(
            config.public.appwriteDatabaseId,
            "players",
            newHost.$id,
            { isHost: true }
        );
      }
    }
  };

  const handleJoin = async (
      username: string,
      lobbyCode: string,
      error: Ref<string>,
      joining: Ref<boolean>,
      router: ReturnType<typeof useRouter>
  ) => {
    if (joining.value) return;
    joining.value = true;
    try {
      const { account } = getAppwrite();
      error.value = "";
      if (!userStore.session) await account.createAnonymousSession();
      await userStore.fetchUserSession();
      const user = await account.get();
      const code = lobbyCode.toUpperCase();
      const lobby = await getLobbyByCode(code);
      if (!lobby) {
        error.value = "Lobby not found.";
        return;
      }
      const inLobby = await isInLobby(user.$id, lobby.$id);
      if (inLobby) return router.push(`/lobby/${lobby.code}`);
      const joinedLobby = await joinLobby(code, { username });
      if (joinedLobby?.code) {
        await router.push(`/lobby/${joinedLobby.code}`);
      } else {
        error.value = "Failed to join the lobby.";
      }
    } catch (err: any) {
      error.value = err.message || "Something went wrong while joining.";
      console.error("Join error:", err);
    } finally {
      joining.value = false;
    }
  };

  const setupRealtime = (lobbyId: string, onUpdate: () => Promise<void>) => {
    const { client } = getAppwrite();
    const config = getConfig();
    return client?.subscribe(
        `databases.${config.public.appwriteDatabaseId}.collections.players.documents`,
        async (response) => {
          const { payload, events } = response as {
            payload: any;
            events: string[];
          };
          if (
              events.some((e) =>
                  ["create", "delete", "update"].some((ev) => e.includes(ev))
              ) &&
              payload.lobbyId === lobbyId
          ) {
            await onUpdate();
          }
        }
    );
  };

  return {
    createLobby,
    joinLobby,
    getLobbyByCode,
    getActiveLobbyForUser,
    getPlayersForLobby,
    leaveLobby,
    createPlayerIfNeeded,
    isInLobby,
    handleJoin,
    fetchPlayers: getPlayersForLobby,
    setupRealtime,
    toPlainLobby,
  };
};
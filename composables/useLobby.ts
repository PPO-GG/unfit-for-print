import { ID, Permission, Role, Query } from "appwrite";
import type { Models } from "appwrite";
import { useAppwrite } from "~/composables/useAppwrite";
import { useGameState } from "~/composables/useGameState";
import { useUserStore } from "~/stores/userStore";

/**
 * This composable provides methods to manage game lobbies.
 * It allows creating, joining, and leaving lobbies, as well as managing players.
 */
export const useLobby = () => {
  const { databases, account } = useAppwrite();
  const config = useRuntimeConfig();
  const { encodeGameState, decodeGameState } = useGameState();
  const userStore = useUserStore();

  const createLobby = async (hostUserId: string) => {
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

    // Immediately join the lobby as host
    await joinLobby(lobby.code, {
      username: userStore.user?.name ?? "",
      isHost: true,
    });

    return lobby;
  };

  // Create a player document if it doesn't exist
  const createPlayerIfNeeded = async (
    user: Models.User<Models.Preferences>,
    session: Models.Session,
    lobbyId: string,
    username: string,
    isHost: boolean
  ) => {
    const existing = await databases.listDocuments(
      config.public.appwriteDatabaseId,
      "players",
      [
        Query.equal("userId", user.$id),
        Query.equal("lobbyId", lobbyId),
        Query.limit(1),
      ]
    );

    if (existing.total > 0) return;

    const permissions =
      session.provider === "anonymous"
        ? [
            'read("any")',
            'update("users")', // allow any user (anon included) to update
            'delete("users")',
          ]
        : [
            `read("any")`,
            `update("user:${user.$id}")`,
            `delete("user:${user.$id}")`,
          ];

    console.log("Creating player with permissions:", permissions);

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
        provider: session.provider, // <-- ADD THIS
      },
      permissions
    );
  };

  // Join a lobby using its code
  // If the user is not logged in, create an anonymous session
  const joinLobby = async (
    code: string,
    options?: {
      username?: string;
      isHost?: boolean;
      skipSession?: boolean;
    }
  ) => {
    try {
      if (!userStore.session && !options?.skipSession) {
        await account.createAnonymousSession();
      }

      const user = await account.get();
      const username = options?.username ?? user.prefs?.name ?? "Unknown";
      const session = await account.getSession("current");
      const lobby = await getLobbyByCode(code);
      await account.updatePrefs({ name: username });
      await userStore.fetchUserSession();
      if (!lobby) throw new Error("Lobby not found");
      await createPlayerIfNeeded(user, session, lobby.$id, username, false);
      if (!lobby) throw new Error("Lobby not found");

      if (session.provider !== "anonymous") {
        // Only allow logged-in users to update gameState
        const state = decodeGameState(lobby.gameState);
        state.players ??= {};
        state.players[user.$id] = username;

        await databases.updateDocument(
          config.public.appwriteDatabaseId,
          "lobby",
          lobby.$id,
          {
            gameState: encodeGameState(state),
          }
        );
      }

      return lobby;
    } catch (err) {
      console.error("joinLobby failed:", err);
      throw err;
    }
  };

  // Leave a lobby
  const leaveLobby = async (lobbyId: string, userId: string) => {
    const lobby = await databases.getDocument(
      config.public.appwriteDatabaseId,
      "lobby",
      lobbyId
    );

    // 🧹 Delete the player document for the current user
    const res = await databases.listDocuments(
      config.public.appwriteDatabaseId,
      "players",
      [
        Query.equal("userId", userId),
        Query.equal("lobbyId", lobbyId),
        Query.limit(1),
      ]
    );

    if (res.total > 0) {
      await databases.deleteDocument(
        config.public.appwriteDatabaseId,
        "players",
        res.documents[0].$id
      );
    }

    // 👑 If the leaver was the host...
    if (lobby.hostUserId === userId) {
      const remaining = await getPlayersForLobby(lobbyId);

      if (remaining.length === 0) {
        // No one left? Delete the lobby.
        await databases.deleteDocument(
          config.public.appwriteDatabaseId,
          "lobby",
          lobbyId
        );
        return;
      }

      const allAnon = remaining.every((p) => p.provider === "anonymous");

      if (allAnon) {
        // All anon? Clean everything up.
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

      // 🧠 Otherwise: transfer host to first logged-in player
      const newHost = remaining.find((p) => p.provider !== "anonymous");
      if (newHost) {
        await databases.updateDocument(
          config.public.appwriteDatabaseId,
          "lobby",
          lobbyId,
          {
            hostUserId: newHost.userId,
          }
        );

        // ✅ Optionally update the player document too (mark as new host)
        await databases.updateDocument(
          config.public.appwriteDatabaseId,
          "players",
          newHost.$id,
          {
            isHost: true,
          }
        );
      }
    }
  };

  // Fetch a lobby by its code
  const getLobbyByCode = async (code: string) => {
    try {
      const result = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        "lobby",
        [Query.equal("code", code), Query.limit(1)]
      );

      return result.documents[0] ?? null;
    } catch (err) {
      console.error("Failed to fetch lobby:", err);
      return null;
    }
  };

  const getActiveLobbyForUser = async (userId: string) => {
    try {
      const res = await databases.listDocuments(
        config.public.appwriteDatabaseId,
        "players",
        [Query.equal("userId", userId)]
      );

      if (res.total === 0) return null;

      // Now fetch the lobby itself
      const playerDoc = res.documents[0];
      const lobby = await databases.getDocument(
        config.public.appwriteDatabaseId,
        "lobby",
        playerDoc.lobbyId
      );

      if (lobby.status === "complete") return null;

      return lobby;
    } catch (err) {
      console.error("Failed to fetch active lobby:", err);
      return null;
    }
  };

  const getPlayersForLobby = async (lobbyId: string) => {
    const res = await databases.listDocuments(
      config.public.appwriteDatabaseId,
      "players",
      [Query.equal("lobbyId", lobbyId)]
    );
    return res.documents;
  };

  // Check if a user is in a lobby
  // This is used to check if a user is already in a lobby before joining
  const isInLobby = async (userId: string, lobbyId: string) => {
    const res = await databases.listDocuments(
      config.public.appwriteDatabaseId,
      "players",
      [
        Query.equal("userId", userId),
        Query.equal("lobbyId", lobbyId),
        Query.limit(1),
      ]
    );
    return res.total > 0;
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
  };
};

// composables/usePlayers.ts
import { Query, type Models } from "appwrite";
import { getAppwrite } from "~/utils/appwrite";
import type { Player } from "~/types/player";
import { useUserStore } from "~/stores/userStore";

export const usePlayers = () => {
  const getConfig = () => useRuntimeConfig();
  const getPlayersForLobby = async (lobbyId: string): Promise<Player[]> => {
    try {
      const { databases, tables } = getAppwrite();
      const config = getConfig();
      const res = await tables.listRows({
        databaseId: config.public.appwriteDatabaseId,
        tableId: config.public.appwritePlayerCollectionId,
        queries: [Query.equal("lobbyId", lobbyId)],
      });

      return res.rows.map((doc: any) => ({
        $id: doc.$id,
        userId: doc.userId,
        lobbyId: doc.lobbyId,
        name: doc.name,
        avatar: doc.avatar,
        isHost: doc.isHost,
        joinedAt: doc.joinedAt,
        provider: doc.provider,
        playerType: doc.playerType || "player",
      })) satisfies Player[];
    } catch (err) {
      console.error("Failed to fetch players for lobby:", err);
      return [];
    }
  };

  const getUserAvatarUrl = (
    user: Models.User<
      Models.Preferences & {
        discordUserId?: string;
        avatar?: string;
        avatarUrl?: string;
      }
    > | null,
    sessionProvider?: string,
  ): string | null => {
    if (!user || !user.prefs) return null;

    // Preferred: full CDN URL persisted during OAuth callback
    if (user.prefs.avatarUrl) {
      return user.prefs.avatarUrl;
    }

    // Legacy fallback: reconstruct Discord CDN URL from hash + userId
    const discordUserId = user.prefs.discordUserId;
    const avatar = user.prefs.avatar;
    if (discordUserId && avatar) {
      return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatar}.png`;
    }

    // Google avatar is stored as a full URL in prefs
    if (avatar && avatar.startsWith("http")) {
      return avatar;
    }

    // Anonymous users: generate a fun DiceBear avatar from their username
    const username = user.name;
    if (username) {
      return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(username)}`;
    }

    return null;
  };

  const updatePlayerAvatar = async (
    playerId: string,
    avatarUrl: string | null,
  ) => {
    try {
      const { databases, tables } = getAppwrite();
      const config = getConfig();
      await tables.updateRow({
        databaseId: config.public.appwriteDatabaseId,
        tableId: config.public.appwritePlayerCollectionId,
        rowId: playerId,
        data: { avatar: avatarUrl },
      });
    } catch (err) {
      console.error("Failed to update player avatar:", err);
    }
  };

  return {
    getPlayersForLobby,
    getUserAvatarUrl,
    updatePlayerAvatar,
  };
};

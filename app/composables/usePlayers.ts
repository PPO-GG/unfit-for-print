// composables/usePlayers.ts
import type { Models } from "appwrite";
import type { Player } from "~/types/player";

export const usePlayers = () => {
  const { $activityFetch } = useNuxtApp();

  const getPlayersForLobby = async (lobbyId: string): Promise<Player[]> => {
    try {
      return await $activityFetch<Player[]>("/api/players/list", {
        query: { lobbyId },
      });
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
      const ext = avatar.startsWith("a_") ? "gif" : "png";
      return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatar}.${ext}`;
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
      await $activityFetch("/api/players/avatar", {
        method: "POST",
        body: { playerId, avatarUrl },
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

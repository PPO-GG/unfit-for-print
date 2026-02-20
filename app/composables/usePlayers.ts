// composables/usePlayers.ts
import { Query, type Models} from 'appwrite';
import { getAppwrite } from '~/utils/appwrite';
import type { Player } from '~/types/player';
import { useUserStore } from '~/stores/userStore';


export const usePlayers = () => {
  const getConfig = () => useRuntimeConfig();
  const getPlayersForLobby = async (lobbyId: string): Promise<Player[]> => {
    try {
      const { databases } = getAppwrite();
      const config = getConfig();
      const res = await databases.listDocuments(
          config.public.appwriteDatabaseId,
          config.public.appwritePlayerCollectionId,
          [Query.equal('lobbyId', lobbyId)]
      );

      return res.documents.map((doc) => ({
        $id: doc.$id,
        userId: doc.userId,
        lobbyId: doc.lobbyId,
        name: doc.name,
        avatar: doc.avatar,
        isHost: doc.isHost,
        joinedAt: doc.joinedAt,
        provider: doc.provider,
        playerType: doc.playerType || 'player',
      })) satisfies Player[];
    } catch (err) {
      console.error('Failed to fetch players for lobby:', err);
      return [];
    }
  };

  const getUserAvatarUrl = (user: Models.User<Models.Preferences> | null, sessionProvider?: string): string | null => {
    if (!user) {
        console.log('User object is null');
        return null;
    }

    console.log('User object:', user);

    if (!user.prefs) {
        console.log('User preferences are missing');
        return null;
    }

    const provider = sessionProvider ?? user.labels?.[0] ?? user.labels?.[1];
    console.log('Determined provider:', provider);

    if (!provider) {
        console.log('Provider is not available');
        return null;
    }

    if (provider === 'discord') {
        const discordUserId = user.prefs.discordUserId;
        const avatar = user.prefs.avatar;
        console.log('Discord user ID:', discordUserId, 'Avatar:', avatar);
        if (discordUserId && avatar) {
            return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatar}.png`;
        }
    }

    if (provider === 'google' && user.prefs.avatar) {
        console.log('Google avatar URL:', user.prefs.avatar);
        return user.prefs.avatar;  // Google avatars are direct URLs
    }

    console.log('No valid avatar URL found');
    return null;
};

  const updatePlayerAvatar = async (playerId: string, avatarUrl: string | null) => {
    try {
      const { databases } = getAppwrite();
      const config = getConfig();
      await databases.updateDocument(
          config.public.appwriteDatabaseId,
          config.public.appwritePlayerCollectionId,
          playerId,
          { avatar: avatarUrl }
      );
    } catch (err) {
      console.error('Failed to update player avatar:', err);
    }
  };

  return {
    getPlayersForLobby,
    getUserAvatarUrl,
    updatePlayerAvatar
  };
};

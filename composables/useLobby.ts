import { ref } from 'vue';
import { ID, Permission, Query, Role, type Models } from 'appwrite';
import { useAppwrite } from '~/composables/useAppwrite';
import { useUserStore } from '~/stores/userStore';
import { useGameState } from '~/composables/useGameState';
import { useGameEngine } from '~/composables/useGameEngine';
import { isAnonymousUser } from '~/composables/useUserUtils';
import { getAppwrite } from '~/utils/appwrite';
import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';

export const useLobby = () => {
    const players = ref<Player[]>([]);

    const getConfig = () => useRuntimeConfig();
    const userStore = useUserStore();
    const { encodeGameState, decodeGameState } = useGameState();
    const { generateGameState } = useGameEngine();

    const toPlainLobby = (doc: any): Lobby => ({ ...doc } as Lobby);

    const fetchPlayers = async (lobbyId: string) => {
        const { databases } = getAppwrite();
        const config = getConfig();
        const res = await databases.listDocuments(config.public.appwriteDatabaseId, 'players', [
            Query.equal('lobbyId', lobbyId),
        ]);
        players.value = res.documents.map((doc) => ({
            $id: doc.$id,
            userId: doc.userId,
            lobbyId: doc.lobbyId,
            name: doc.name,
            avatar: doc.avatar,
            isHost: doc.isHost,
            joinedAt: doc.joinedAt,
            provider: doc.provider,
        }));
    };

    const getLobbyByCode = async (code: string): Promise<Lobby | null> => {
        const { databases } = getAppwrite();
        const config = getConfig();
        const result = await databases.listDocuments(config.public.appwriteDatabaseId, 'lobby', [
            Query.equal('code', code),
            Query.limit(1),
        ]);
        return result.documents[0] ? result.documents[0] as unknown as Lobby : null;
    };

    const createLobby = async (hostUserId: string) => {
        const { databases } = getAppwrite();
        const config = getConfig();
        const lobbyCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        const lobbyData = {
            hostUserId,
            code: lobbyCode,
            status: 'waiting',
            round: 0,
            gameState: encodeGameState({
                phase: 'waiting',
                round: 0,
                players: {},
                scores: {},
                hands: {},
                playedCards: {},
                whiteDeck: [],
                blackDeck: [],
                blackCard: null,
                judge: null,
            }),
        };

        const permissions = [
            Permission.read(Role.any()),
            Permission.update(Role.user(hostUserId)),
            Permission.delete(Role.user(hostUserId)),
        ];

        const lobby = await databases.createDocument(
            config.public.appwriteDatabaseId,
            'lobby',
            ID.unique(),
            lobbyData,
            permissions
        );

        await joinLobby(lobby.code, {
            username: userStore.user?.name ?? 'Anonymous',
            isHost: true,
        });

        return { ...lobby };
    };

    const isInLobby = async (userId: string, lobbyId: string) => {
        const { databases } = getAppwrite();
        const config = getConfig();
        const res = await databases.listDocuments(config.public.appwriteDatabaseId, 'players', [
            Query.equal('userId', userId),
            Query.equal('lobbyId', lobbyId),
            Query.limit(1),
        ]);
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
        const session = await account.getSession('current');
        const username = options?.username ?? user.prefs?.name ?? 'Unknown';
        const lobby = await getLobbyByCode(code);
        if (!lobby) throw new Error('Lobby not found');

        await account.updatePrefs({ name: username });
        await userStore.fetchUserSession();
        await createPlayerIfNeeded(user, session, lobby.$id, username, !!options?.isHost);

        if (session.provider !== 'anonymous') {
            const state = decodeGameState(lobby.gameState);
            state.players ??= {};
            state.players[user.$id] = username;
            await databases.updateDocument(config.public.appwriteDatabaseId, 'lobby', lobby.$id, {
                gameState: encodeGameState(state),
            });
        }

        return { ...lobby };
    };

    const getActiveLobbyForUser = async (userId: string): Promise<Lobby | null> => {
        const { databases } = getAppwrite();
        const config = getConfig();

        const playerRes = await databases.listDocuments(config.public.appwriteDatabaseId, 'players', [
            Query.equal('userId', userId),
            Query.limit(1),
        ]);

        if (playerRes.total === 0) return null;

        const playerDoc = playerRes.documents[0];
        const lobby = await databases.getDocument(config.public.appwriteDatabaseId, 'lobby', playerDoc.lobbyId);

        if (lobby.status === 'complete') return null;
        return lobby as unknown as Lobby;
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
        const existing = await databases.listDocuments(config.public.appwriteDatabaseId, 'players', [
            Query.equal('userId', user.$id),
            Query.equal('lobbyId', lobbyId),
            Query.limit(1),
        ]);
        if (existing.total > 0) return;

        const permissions = isAnonymousUser(user)
            ? ['read("any")', 'update("users")', 'delete("users")']
            : [`read("any")`, `update("user:${user.$id}")`, `delete("user:${user.$id}")`];

        await databases.createDocument(
            config.public.appwriteDatabaseId,
            'players',
            ID.unique(),
            {
                userId: user.$id,
                lobbyId,
                name: username,
                avatar: user.prefs?.avatar ?? '',
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
        const lobby = await databases.getDocument(config.public.appwriteDatabaseId, 'lobby', lobbyId);

        const res = await databases.listDocuments(config.public.appwriteDatabaseId, 'players', [
            Query.equal('userId', userId),
            Query.equal('lobbyId', lobbyId),
            Query.limit(1),
        ]);

        if (res.total > 0) {
            await databases.deleteDocument(
                config.public.appwriteDatabaseId,
                'players',
                res.documents[0].$id
            );
        }

        if (lobby.hostUserId === userId) {
            await fetchPlayers(lobbyId);
            if (players.value.length === 0 || players.value.every((p) => p.provider === 'anonymous')) {
                for (const player of players.value) {
                    await databases.deleteDocument(config.public.appwriteDatabaseId, 'players', player.$id);
                }
                await databases.deleteDocument(config.public.appwriteDatabaseId, 'lobby', lobbyId);
                return;
            }
            const newHost = players.value.find((p) => p.provider !== 'anonymous');
            if (newHost) {
                await databases.updateDocument(config.public.appwriteDatabaseId, 'lobby', lobbyId, {
                    hostUserId: newHost.userId,
                });
                await databases.updateDocument(config.public.appwriteDatabaseId, 'players', newHost.$id, {
                    isHost: true,
                });
            }
        }
    };

    const startGame = async (lobbyId: string, hostUserId: string) => {
        const { databases } = getAppwrite();
        const config = getConfig();

        await fetchPlayers(lobbyId);
        const validPlayers = players.value.filter((p) => p.userId);
        if (validPlayers.length < 3) throw new Error('Not enough players to start');

        const gameState = await generateGameState(validPlayers);
        await databases.updateDocument(config.public.appwriteDatabaseId, 'lobby', lobbyId, {
            status: 'playing',
            gameState: encodeGameState(gameState),
        });
    };

    const kickPlayer = async (playerId: string) => {
        const { databases } = getAppwrite();
        const config = getConfig();
        await databases.deleteDocument(config.public.appwriteDatabaseId, 'players', playerId);
    };

    const promoteToHost = async (lobbyId: string, newHostPlayer: Player) => {
        const { databases } = getAppwrite();
        const config = getConfig();

        await databases.updateDocument(config.public.appwriteDatabaseId, 'lobby', lobbyId, {
            hostUserId: newHostPlayer.userId,
        });

        await databases.updateDocument(config.public.appwriteDatabaseId, 'players', newHostPlayer.$id, {
            isHost: true,
        });
    };

    return {
        players,
        fetchPlayers,
        createLobby,
        joinLobby,
        getLobbyByCode,
        leaveLobby,
        isInLobby,
        toPlainLobby,
        startGame,
        kickPlayer,
        promoteToHost,
        getActiveLobbyForUser,
        createPlayerIfNeeded,
    };
};

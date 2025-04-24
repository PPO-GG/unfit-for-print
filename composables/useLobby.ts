import { ref } from 'vue';
import { ID, Permission, Query, Role, type Models } from 'appwrite';
import { useAppwrite } from '~/composables/useAppwrite';
import { useUserStore } from '~/stores/userStore';
import { useGameState } from '~/composables/useGameState';
import { useGameEngine } from '~/composables/useGameEngine';
import { useGameActions } from '~/composables/useGameActions';
import { isAnonymousUser } from '~/composables/useUserUtils';
import { getAppwrite } from '~/utils/appwrite';
import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';

export const useLobby = () => {
    const players = ref<Player[]>([]);

    const getConfig = () => {
        // Try to get the safe config from the Appwrite plugin first
        const { safeConfig: pluginSafeConfig } = useAppwrite();

        // If the plugin's safe config is available, use it
        if (pluginSafeConfig) {
            console.log('Using safe config from Appwrite plugin');
            return pluginSafeConfig;
        }

        // Otherwise, create our own safe config
        console.log('Creating safe config in useLobby');
        const config = useRuntimeConfig();

        // Create a safe copy of the config with string-enforced collection IDs
        const safeConfig = {
            ...config,
            public: {
                ...config.public,
                appwriteDatabaseId: String(config.public.appwriteDatabaseId),
                appwriteLobbyCollectionId: String(config.public.appwriteLobbyCollectionId),
                appwritePlayerCollectionId: String(config.public.appwritePlayerCollectionId)
            }
        };

        // Ensure collection IDs are properly set
        if (!safeConfig.public.appwriteDatabaseId || 
            !safeConfig.public.appwriteLobbyCollectionId || 
            !safeConfig.public.appwritePlayerCollectionId ||
            safeConfig.public.appwriteLobbyCollectionId === 'Infinite' ||
            safeConfig.public.appwritePlayerCollectionId === 'Infinite' ||
            safeConfig.public.appwriteLobbyCollectionId === 'undefined' ||
            safeConfig.public.appwritePlayerCollectionId === 'undefined') {
            console.error('Invalid Appwrite configuration:', {
                databaseId: safeConfig.public.appwriteDatabaseId,
                lobbyCollectionId: safeConfig.public.appwriteLobbyCollectionId,
                playerCollectionId: safeConfig.public.appwritePlayerCollectionId,
                originalDatabaseIdType: typeof config.public.appwriteDatabaseId,
                originalLobbyCollectionIdType: typeof config.public.appwriteLobbyCollectionId,
                originalPlayerCollectionIdType: typeof config.public.appwritePlayerCollectionId
            });
            throw new Error('Appwrite configuration is invalid. Check your environment variables.');
        }

        return safeConfig;
    };
    const userStore = useUserStore();
    const { encodeGameState, decodeGameState } = useGameState();
    const { generateGameState } = useGameEngine();

    const toPlainLobby = (doc: any): Lobby => ({ ...doc } as Lobby);

    const fetchPlayers = async (lobbyId: string) => {
        const { databases } = getAppwrite();
        const config = getConfig();
        const res = await databases.listDocuments(config.public.appwriteDatabaseId, config.public.appwritePlayerCollectionId, [
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
        try {
            const result = await databases.listDocuments(
                config.public.appwriteDatabaseId,
                config.public.appwriteLobbyCollectionId,
                [
                    Query.equal('code', code),
                    Query.limit(1),
                ]
            );
            return result.documents[0] ? result.documents[0] as unknown as Lobby : null;
        } catch (error: unknown) {
            if (error instanceof Error &&
                'code' in error &&
                error.code === 404 &&
                error.message?.includes('Collection with the requested ID could not be found')) {
                console.warn('Lobby collection not initialized');
                return null;
            }
            throw error;
        }
    };

    const createLobby = async (hostUserId: string) => {
        const { databases } = getAppwrite();
        const config = getConfig();
        const lobbyCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        console.log('Appwrite Configuration in createLobby:', {
            databaseId: config.public.appwriteDatabaseId,
            lobbyCollectionId: config.public.appwriteLobbyCollectionId,
            playerCollectionId: config.public.appwritePlayerCollectionId,
            lobbyCollectionIdType: typeof config.public.appwriteLobbyCollectionId,
            playerCollectionIdType: typeof config.public.appwritePlayerCollectionId,
            isPlayerCollectionIdInfinity: config.public.appwritePlayerCollectionId === Infinity,
            playerCollectionIdValue: String(config.public.appwritePlayerCollectionId)
        });

        try {
            // First, verify if collections exist by doing a test query
            try {
                await databases.listDocuments(
                    config.public.appwriteDatabaseId,
                    config.public.appwriteLobbyCollectionId,
                    [Query.limit(1)]
                );
            } catch (error: unknown) {
                if (error instanceof Error &&
                    'code' in error &&
                    error.code === 404) {
                    console.error('Lobby collection not found:', config.public.appwriteLobbyCollectionId);
                    throw new Error('Unable to create lobby: Database not properly configured');
                }
                throw error;
            }

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
                config.public.appwriteLobbyCollectionId,
                ID.unique(),
                lobbyData,
                permissions
            );

            // Also verify players collection before joining
            try {
                await databases.listDocuments(
                    config.public.appwriteDatabaseId,
                    config.public.appwritePlayerCollectionId,
                    [Query.limit(1)]
                );
            } catch (error: unknown) {
                if (error instanceof Error &&
                    'code' in error &&
                    error.code === 404) {
                    // Clean up the created lobby since we can't create players
                    await databases.deleteDocument(
                        config.public.appwriteDatabaseId,
                        config.public.appwriteLobbyCollectionId,
                        lobby.$id
                    );
                    console.error('Players collection not found:', config.public.appwritePlayerCollectionId);
                    throw new Error('Unable to create lobby: Database not properly configured');
                }
                throw error;
            }

            await joinLobby(lobby.code, {
                username: userStore.user?.name ?? 'Anonymous',
                isHost: true,
            });

            return { ...lobby };
        } catch (error: unknown) {
            if (error instanceof Error) {
                // Enhance error message to include collection IDs for debugging
                const message = error.message === 'Unable to create lobby: Database not properly configured'
                    ? `Database configuration error. Please verify collections exist: Lobby (${config.public.appwriteLobbyCollectionId}) and Players (${config.public.appwritePlayerCollectionId})`
                    : error.message;
                throw new Error(message);
            }
            throw error;
        }
    };

    const isInLobby = async (userId: string, lobbyId: string) => {
        const { databases } = getAppwrite();
        const config = getConfig();
        const res = await databases.listDocuments(config.public.appwriteDatabaseId, config.public.appwritePlayerCollectionId, [
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
            await databases.updateDocument(config.public.appwriteDatabaseId, config.public.appwriteLobbyCollectionId, lobby.$id, {
                gameState: encodeGameState(state),
            });
        }

        return { ...lobby };
    };

    const getActiveLobbyForUser = async (userId: string): Promise<Lobby | null> => {
        const { databases } = getAppwrite();
        const config = getConfig();

        try {
            const playerRes = await databases.listDocuments(
                config.public.appwriteDatabaseId,
                config.public.appwritePlayerCollectionId,
                [
                    Query.equal('userId', userId),
                    Query.limit(1),
                ]
            );

            if (playerRes.total === 0) return null;

            const playerDoc = playerRes.documents[0];
            const lobby = await databases.getDocument(
                config.public.appwriteDatabaseId,
                config.public.appwriteLobbyCollectionId,
                playerDoc.lobbyId
            );

            if (lobby.status === 'complete') return null;
            return lobby as unknown as Lobby;
        } catch (error: unknown) {
            if (error instanceof Error &&
                'code' in error &&
                error.code === 404 &&
                error.message?.includes('Collection with the requested ID could not be found')) {
                console.warn('Players or lobby collection not initialized');
                return null;
            }
            throw error;
        }
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
        const existing = await databases.listDocuments(config.public.appwriteDatabaseId, config.public.appwritePlayerCollectionId, [
            Query.equal('userId', user.$id),
            Query.equal('lobbyId', lobbyId),
            Query.limit(1),
        ]);
        if (existing.total > 0) return;

        const permissions = isAnonymousUser(user)
            // ? ['read("any")', 'update("users")', 'delete("users")']
            ? [
                'read("any")', 'update("any")', 'delete("any")'
              ]
            : [`read("any")`, `update("user:${user.$id}")`, `delete("user:${user.$id}")`];

        await databases.createDocument(
            config.public.appwriteDatabaseId,
            config.public.appwritePlayerCollectionId,
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
        const lobby = await databases.getDocument(config.public.appwriteDatabaseId, config.public.appwriteLobbyCollectionId, lobbyId);

        const res = await databases.listDocuments(config.public.appwriteDatabaseId, config.public.appwritePlayerCollectionId, [
            Query.equal('userId', userId),
            Query.equal('lobbyId', lobbyId),
            Query.limit(1),
        ]);

        if (res.total > 0) {
            await databases.deleteDocument(
                config.public.appwriteDatabaseId,
                config.public.appwritePlayerCollectionId,
                res.documents[0].$id
            );
        }

        // Fetch all remaining players
        await fetchPlayers(lobbyId);

        if (lobby.hostUserId === userId) {
            if (players.value.length === 0 || players.value.every((p) => p.provider === 'anonymous')) {
                for (const player of players.value) {
                    await databases.deleteDocument(config.public.appwriteDatabaseId, config.public.appwritePlayerCollectionId, player.$id);
                }
                await databases.deleteDocument(config.public.appwriteDatabaseId, config.public.appwriteLobbyCollectionId, lobbyId);
                return;
            }
            const newHost = players.value.find((p) => p.provider !== 'anonymous');
            if (newHost) {
                await databases.updateDocument(config.public.appwriteDatabaseId, config.public.appwriteLobbyCollectionId, lobbyId, {
                    hostUserId: newHost.userId,
                });
                await databases.updateDocument(config.public.appwriteDatabaseId, config.public.appwritePlayerCollectionId, newHost.$id, {
                    isHost: true,
                });
            }
        }

        // Check if there are fewer than 3 players left and the game is in progress
        if (players.value.length < 3 && lobby.status === 'playing') {
            // Update the game state to "waiting"
            const state = decodeGameState(lobby.gameState);
            state.phase = 'waiting';

            await databases.updateDocument(config.public.appwriteDatabaseId, config.public.appwriteLobbyCollectionId, lobbyId, {
                status: 'waiting',
                gameState: encodeGameState(state)
            });
        }
    };

    const startGame = async (lobbyId: string) => {
        // Validate we have enough players
        await fetchPlayers(lobbyId);
        const validPlayers = players.value.filter((p) => p.userId);
        if (validPlayers.length < 3) throw new Error('Not enough players to start');

        const { startGame: startGameFunction } = useGameActions();
        try {
            const result = await startGameFunction(lobbyId);

            // Early return if no result
            if (!result) {
                throw new Error('No response from server function');
            }

            // Handle the execution result based on Appwrite's Function Execution type
            if ('status' in result && result.status === 'completed') {
                // Try to parse the response from the execution
                let functionResponse;
                try {
                    if (result.responseBody) {
                        functionResponse = typeof result.responseBody === 'string'
                            ? JSON.parse(result.responseBody)
                            : result.responseBody;
                    } else {
                        // If no response body, assume success
                        functionResponse = { success: true };
                    }
                } catch (e) {
                    console.error('Failed to parse function response:', e);
                    throw new Error('Invalid response format from server function');
                }

                if (!functionResponse.success) {
                    throw new Error(functionResponse.error || 'Failed to start game');
                }

                return functionResponse;
            }

            throw new Error('Function execution failed or returned invalid status');
        } catch (error) {
            console.error('Error calling startGame server function:', error);
            throw error;
        }
    };


    const kickPlayer = async (playerId: string) => {
        const { databases } = getAppwrite();
        const config = getConfig();
        await databases.deleteDocument(config.public.appwriteDatabaseId, config.public.appwritePlayerCollectionId, playerId);
    };

    const promoteToHost = async (lobbyId: string, newHostPlayer: Player) => {
        const { databases } = getAppwrite();
        const config = getConfig();

        await databases.updateDocument(config.public.appwriteDatabaseId, config.public.appwriteLobbyCollectionId, lobbyId, {
            hostUserId: newHostPlayer.userId,
        });

        await databases.updateDocument(config.public.appwriteDatabaseId, config.public.appwritePlayerCollectionId, newHostPlayer.$id, {
            isHost: true,
        });
    };

    const resetGameState = async (lobbyId: string) => {
        const { databases } = getAppwrite();
        const config = getConfig();

        try {
            // Get the current lobby
            const lobby = await databases.getDocument(
                config.public.appwriteDatabaseId,
                config.public.appwriteLobbyCollectionId,
                lobbyId
            );

            // Decode the current game state
            const state = decodeGameState(lobby.gameState);

            // Update the game state to waiting phase
            state.phase = 'waiting';

            // Update the lobby status and game state
            await databases.updateDocument(
                config.public.appwriteDatabaseId,
                config.public.appwriteLobbyCollectionId,
                lobbyId,
                {
                    status: 'waiting',
                    gameState: encodeGameState(state)
                }
            );

            return true;
        } catch (error) {
            console.error('Error resetting game state:', error);
            throw error;
        }
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
        resetGameState,
    };
};

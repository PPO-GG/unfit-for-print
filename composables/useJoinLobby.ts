// composables/useJoinLobby.ts
import { useRouter } from 'vue-router';
import { useLobby } from '~/composables/useLobby';
import { useUserStore } from '~/stores/userStore';
import { useProfanityFilter } from '~/composables/useProfanityFilter';
import { getAppwrite } from '~/utils/appwrite';

export const useJoinLobby = () => {
    const router = useRouter();
    const { getLobbyByCode, isInLobby, joinLobby, getActiveLobbyForUser } = useLobby();
    const userStore = useUserStore();
    const { isBadUsername } = useProfanityFilter();

    const initSessionIfNeeded = async () => {
        const { databases, account } = getAppwrite();
        if (!userStore.session) {
            await account.createAnonymousSession();
        }
        await userStore.fetchUserSession();
    };

    const validateUsername = (username: string): string | null => {
        if (!username.trim()) return 'Please enter a username.';
        if (isBadUsername(username)) return "That name isn't allowed.";
        return null;
    };

    const joinLobbyWithSession = async (
        username: string,
        lobbyCode: string,
        setError?: (message: string) => void,
        setJoining?: (state: boolean) => void
    ) => {
        try {
            setError?.('');
            setJoining?.(true);

            await initSessionIfNeeded();

            const user = userStore.user;
            if (!user) throw new Error('No user session');

            const errorMsg = validateUsername(username);
            if (errorMsg) {
                setError?.(errorMsg);
                return;
            }

            const code = lobbyCode.trim().toUpperCase();
            const lobby = await getLobbyByCode(code);
            if (!lobby) {
                setError?.('Lobby not found.');
                return;
            }

            const inLobby = await isInLobby(user.$id, lobby.$id);
            if (inLobby) {
                return router.push(`/game/${lobby.code}`);
            }

            const joinedLobby = await joinLobby(code, { username });
            if (joinedLobby?.code) {
                return router.push(`/game/${joinedLobby.code}`);
            }

            setError?.('Failed to join the lobby.');
        } catch (err: any) {
            console.error('Join error:', err);
            setError?.(err.message || 'Something went wrong while joining.');
        } finally {
            setJoining?.(false);
        }
    };

    const checkJoinAccess = async (lobbyCode: string, onFail: () => void) => {
        await initSessionIfNeeded()

        const user = userStore.user
        if (!user) return onFail()

        const activeLobby = await getActiveLobbyForUser(user.$id)
        if (!activeLobby || activeLobby.code !== lobbyCode) {
            return onFail()
        }

        return true
    }

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

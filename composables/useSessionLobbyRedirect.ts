// composables/useSessionLobbyRedirect.ts
import { useUserStore } from '~/stores/userStore';
import { useLobby } from '~/composables/useLobby';
import { isAnonymousUser } from '~/composables/useUserUtils';
import { useRouter } from 'vue-router';

export const useSessionLobbyRedirect = () => {
    const userStore = useUserStore();
    const router = useRouter();
    const { getActiveLobbyForUser } = useLobby();

    const checkAndRedirect = async () => {
        await userStore.fetchUserSession();

        const user = userStore.user;
        if (!user) return;

        if (isAnonymousUser(user)) {
            return router.replace('/join');
        }

        const lobby = await getActiveLobbyForUser(user.$id);
        if (lobby?.code) {
            return router.replace(`/game/${lobby.code}`);
        }
    };

    return { checkAndRedirect };
};
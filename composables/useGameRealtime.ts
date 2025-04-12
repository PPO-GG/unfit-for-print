// composables/useGameRealtime.ts
import { watchEffect, onUnmounted } from 'vue';
import { getAppwrite } from '~/utils/appwrite';
import { useNotifications } from '~/composables/useNotifications';
import type { Lobby } from '~/types/lobby';

interface UseGameRealtimeOptions {
    lobby: Lobby;
    getPlayedCards?: () => Record<string, string>;
    onUpdatePlayedCards?: (playedCards: Record<string, string>) => Promise<void>;
    onPhaseChange?: (newPhase: string) => void;
    onLobbyDeleted?: () => void;
    onPlayersUpdated?: () => Promise<void>;
}

export const useGameRealtime = ({
    lobby,
    getPlayedCards,
    onUpdatePlayedCards,
    onPhaseChange,
    onLobbyDeleted,
    onPlayersUpdated
}: UseGameRealtimeOptions) => {
    const { client } = getAppwrite();
    const config = useRuntimeConfig();
    const { notify } = useNotifications();

    const lobbySub = client.subscribe(
        [`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteLobbyCollectionId}.documents.${lobby.$id}`],
        async (response: { events: string[]; payload: any }) => {
            const { events, payload } = response;

            if (events.includes('databases.*.update')) {
                const updatedState = JSON.parse(payload.gameState);

                if (
                    onUpdatePlayedCards &&
                    updatedState.playedCards &&
                    (!getPlayedCards || JSON.stringify(getPlayedCards()) !== JSON.stringify(updatedState.playedCards))
                ) {
                    await onUpdatePlayedCards(updatedState.playedCards);
                }

                const currentState = JSON.parse(lobby.gameState);
                if (onPhaseChange && updatedState.phase && updatedState.phase !== currentState.phase) {
                    onPhaseChange(updatedState.phase);
                }
            }

            if (events.includes('databases.*.delete')) {
                notify('Lobby was deleted', 'info');
                if (onLobbyDeleted) onLobbyDeleted();
            }
        }
    );

    const playerSub = client.subscribe(
        [`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwritePlayersCollectionId}.documents`],
        async (response: { events: string[]; payload?: any }) => {
            const { events, payload } = response;

            const isCreateOrUpdate = events.some(e => e.includes('create') || e.includes('update'));
            const isDelete = events.some(e => e.includes('delete'));

            if ((isCreateOrUpdate && payload?.lobbyId === lobby.$id) || isDelete) {
                // 🔁 Always refetch on delete (no lobbyId check possible)
                if (onPlayersUpdated) await onPlayersUpdated();
            }
        }
    );

    onUnmounted(() => {
        lobbySub(); // unsubscribe both
        playerSub();
    });
};

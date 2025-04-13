import { onUnmounted } from 'vue';
import { getAppwrite } from '~/utils/appwrite';
import { useNotifications } from '~/composables/useNotifications';
import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';
import type { GameState } from "~/types/game";

interface UseGameRealtimeOptions {
    lobby: Lobby;
    onPlayersUpdated?: () => Promise<void>;
    onUpdatePlayedCards?: (playedCards: Record<string, string>) => Promise<void>;
    onPhaseChange?: (newPhase: string) => void;
    onLobbyDeleted?: () => void;
}

export const useGameRealtime = ({
                                    lobby,
                                    onPlayersUpdated,
                                    onUpdatePlayedCards,
                                    onPhaseChange,
                                    onLobbyDeleted
                                }: UseGameRealtimeOptions) => {
    const { client } = getAppwrite();
    const config = useRuntimeConfig();
    const { notify } = useNotifications();

    // 🧠 Lobby Document Subscription
    const lobbySub = client.subscribe(
        [`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteLobbyCollectionId}.documents.${lobby.$id}`],
        async ({ events, payload }) => {
            const doc = payload as { gameState: string };
            console.log('[Realtime Lobby Event]', events, payload);

            if (events.some(e => e.includes('.update')) && (payload as { gameState?: string })?.gameState) {
                const updatedState = JSON.parse((payload as { gameState: string }).gameState) as GameState;
                const currentState = JSON.parse(lobby.gameState) as GameState;

                if (
                    onUpdatePlayedCards &&
                    updatedState.playedCards &&
                    JSON.stringify(updatedState.playedCards) !== JSON.stringify(currentState.playedCards)
                ) {
                    await onUpdatePlayedCards(updatedState.playedCards);
                }

                if (onPhaseChange && updatedState.phase !== currentState.phase) {
                    onPhaseChange(updatedState.phase);
                }
            }

            if (events.some(e => e.endsWith('.delete'))) {
                console.log('🚨 Lobby deleted!');
                notify({
                    title: 'Lobby Deleted',
                    description: 'The lobby you were in has been deleted.',
                    color: 'error',
                    duration: 5000,
                })
                onLobbyDeleted?.();
            }
        }
    );

    // 👥 Player Collection Subscription
    const playerSub = client.subscribe(
        [`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwritePlayersCollectionId}.documents`],
        async ({ events, payload }: { events: string[]; payload?: unknown }) => {
            const player = payload as Player
            console.log('🔥 [Realtime Player Event TRIGGERED]')
            console.log('🔍 Events:', events)
            console.log('📦 Payload:', payload)

            const isCreateOrUpdate = events.some(e => e.includes('create') || e.includes('update'))
            const isDelete = events.some(e => e.includes('delete'))

            const shouldUpdate =
                (isCreateOrUpdate && player.lobbyId === lobby.$id) ||
                isDelete // ← still catch deletes even if we can’t confirm lobbyId

            if (shouldUpdate) {
                console.log('👥 Player changed, refetching...')
                await onPlayersUpdated?.()
            }
        }
    )

    onUnmounted(() => {
        lobbySub();
        playerSub();
    });
};

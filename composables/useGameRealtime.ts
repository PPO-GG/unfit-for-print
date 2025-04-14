import { onUnmounted } from 'vue';
import { getAppwrite } from '~/utils/appwrite';
import { Client } from 'appwrite';
import { useNotifications } from '~/composables/useNotifications';
import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';
import type { GameState } from '~/types/game';

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
    onLobbyDeleted,
}: UseGameRealtimeOptions) => {
    const { client } = getAppwrite();
    const config = useRuntimeConfig();
    const { notify } = useNotifications();

    // 🧠 Lobby Document Subscription
    const unsubscribeLobby = client.subscribe(
        [`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteLobbyCollectionId}.documents.${lobby.$id}`],
        async ({ events, payload }) => {
            const doc = payload as { gameState: string };
            console.log('[Realtime Lobby Event]', events, payload);

            if (events.some((e) => e.includes('.update')) && doc?.gameState) {
                const updatedState = JSON.parse(doc.gameState) as GameState;
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

            if (events.some((e) => e.endsWith('.delete'))) {
                console.log('🚨 Lobby deleted!');
                notify({
                    title: 'Lobby Deleted',
                    description: 'The lobby you were in has been deleted.',
                    color: 'error',
                    duration: 5000,
                });
                onLobbyDeleted?.();
            }
        }
    );

    // 👥 Player Collection Subscription
    const unsubscribePlayers = client.subscribe(
        [`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwritePlayersCollectionId}.documents.*`],
        async ({ events, payload }) => {
            try {
                // Confirm session is active (dev check, not strictly necessary in production)
                const { account } = getAppwrite();
                const current = await account.getSession('current');
                console.log('👤 Session bound:', current.$id);
            } catch {
                console.warn('⚠️ Could not retrieve session (this may block realtime)');
                return; // skip if session isn't available
            }

            console.log('🔥 [Player Event Triggered]', { events, payload });

            const player = payload as Player | undefined;

            // Normalize event type checks
            const eventType = events.find(e =>
                e.includes('create') || e.includes('update') || e.includes('delete')
            );

            if (!eventType) return;

            // Deletion events have no payload — so fallback to always trigger if delete
            const isDelete = eventType.includes('delete');
            const matchesLobby = player?.lobbyId === lobby.$id;

            if ((player && matchesLobby) || isDelete) {
                console.log('🔁 Triggering onPlayersUpdated due to', eventType);
                await onPlayersUpdated?.();
            }
        }
    );

    // Cleanup subscriptions on unmount
    onUnmounted(() => {
        console.log('🧹 Cleaning up subscriptions...');
        unsubscribeLobby?.();
        unsubscribePlayers?.();
    });
};
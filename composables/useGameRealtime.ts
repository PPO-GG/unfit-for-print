import { onUnmounted, ref } from 'vue';
import type { Ref } from 'vue';
import { getAppwrite } from '~/utils/appwrite';
import { Client } from 'appwrite';
import { useNotifications } from '~/composables/useNotifications';
import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';
import type { GameState } from '~/types/game';
import { useRouter } from 'vue-router';
import { useUserStore } from '~/stores/userStore';

interface UseGameRealtimeOptions {
    lobby: Ref<Lobby | null>;
    onPlayersUpdated?: () => Promise<void>;
    onUpdatePlayedCards?: (playedCards: Record<string, string>) => Promise<void>;
    onSubmissionsUpdated?: (submissions: Record<string, any>) => void;
    onPhaseChange?: (newPhase: string) => void;
    onLobbyDeleted?: () => void;
    onPlayerKicked?: () => Promise<void>;
}

export const useGameRealtime = ({
    lobby,
    onPlayersUpdated,
    onUpdatePlayedCards,
    onSubmissionsUpdated,
    onPhaseChange,
    onLobbyDeleted,
    onPlayerKicked,
}: UseGameRealtimeOptions) => {
    const { client } = getAppwrite();
    const config = useRuntimeConfig();
    const { notify } = useNotifications();
    const userStore = useUserStore();
    const router = useRouter();
    const selfLeaving = ref(false);

    // Ensure we have a valid lobby
    if (!lobby.value) {
        console.error('useGameRealtime: lobby.value is null');
        return { cleanup: () => {} };
    }

    // 🧠 Lobby Document Subscription
    const unsubscribeLobby = client.subscribe(
        [`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteLobbyCollectionId}.documents.${lobby.value.$id}`],
        async ({ events, payload }) => {
            const doc = payload as { gameState: string, status: string };
            console.log('[Realtime Lobby Event]', events, payload);

            if (events.some((e) => e.includes('.update')) && lobby.value) {
                // Update the entire lobby object with all properties from the payload
                if (doc?.gameState) {
                    let updatedState: GameState;
                    let currentState: GameState;

                    try {
                        updatedState = JSON.parse(doc.gameState) as GameState;
                        currentState = JSON.parse(lobby.value.gameState) as GameState;
                    } catch (error) {
                        console.error('Failed to parse game state:', error);
                        updatedState = { phase: 'waiting' } as GameState;
                        currentState = { phase: 'waiting' } as GameState;
                    }

                    console.log('[Realtime] Game state updated:', updatedState);

                    // Create a new lobby object to trigger reactivity
                    lobby.value = { ...lobby.value, ...payload as Lobby, gameState: doc.gameState };

                    console.log('[Realtime] Lobby updated:', lobby.value);

                    // If the lobby status is 'playing' but the game state phase is 'waiting',
                    // update the phase to 'submitting' to ensure the GameBoard is displayed
                    if (lobby.value.status === 'playing' && (updatedState.phase === 'waiting' || !updatedState.phase)) {
                        console.log('[Realtime] Fixing game state phase: changing from waiting to submitting');
                        updatedState.phase = 'submitting';

                        // Update the lobby object with the fixed game state
                        const fixedGameState = JSON.stringify(updatedState);
                        lobby.value = { ...lobby.value, gameState: fixedGameState };

                        // Trigger phase change callback
                        if (onPhaseChange) {
                            console.log('[Realtime] Triggering phase change callback for fixed phase');
                            onPhaseChange('submitting');
                        }
                    }

                    if (
                        onUpdatePlayedCards &&
                        updatedState.playedCards &&
                        JSON.stringify(updatedState.playedCards) !== JSON.stringify(currentState.playedCards)
                    ) {
                        await onUpdatePlayedCards(updatedState.playedCards);
                    }

                    // Call the onSubmissionsUpdated callback when submissions change
                    if (
                        onSubmissionsUpdated &&
                        updatedState.submissions &&
                        JSON.stringify(updatedState.submissions) !== JSON.stringify(currentState.submissions)
                    ) {
                        console.log('[Realtime] Submissions updated:', updatedState.submissions);
                        onSubmissionsUpdated(updatedState.submissions);
                    }

                    // Log round changes for debugging
                    if (updatedState.round !== currentState.round) {
                        console.log('[Realtime] Round changed:', updatedState.round);
                    }

                    // Log score changes for debugging
                    if (JSON.stringify(updatedState.scores) !== JSON.stringify(currentState.scores)) {
                        console.log('[Realtime] Scores updated:', updatedState.scores);
                    }

                    if (onPhaseChange && updatedState.phase !== currentState.phase) {
                        console.log('[Realtime] Phase changed from', currentState.phase, 'to', updatedState.phase);
                        onPhaseChange(updatedState.phase);
                    }
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
        [`databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwritePlayerCollectionId}.documents.*`],
        async ({ events, payload }) => {
            // Remove session check as it might be causing issues with realtime updates
            // We don't need to check the session for every player event

            console.log('🔥 [Player Event Triggered]', { events, payload });

            // 1️⃣ If it's a delete event for *your* player doc, redirect immediately
            const isDelete = events.some(e => e.endsWith('.delete'));
            if (isDelete && (payload as Player).userId === userStore.user?.$id) {
                if (selfLeaving.value) {
                    // you clicked Leave
                    notify({
                        title: 'You left the lobby',
                        color: 'info',
                        icon: 'i-mdi-exit-run',
                    });
                } else {
                    // someone else kicked you
                    notify({
                        title: 'You were kicked from the lobby',
                        color: 'error',
                        icon: 'i-mdi-account-remove',
                    });
                }

                // reset the flag so future deletes act normally
                selfLeaving.value = false;

                // Call the onPlayerKicked callback if provided
                await onPlayerKicked?.();
                return;
            }

            const player = payload as Player | undefined;

            // Normalize event type checks
            const eventType = events.find(e =>
                e.includes('create') || e.includes('update') || e.includes('delete')
            );

            if (!eventType) return;

            // Check if the player is in the current lobby or if it's a delete event
            // For delete events, we might not have the player object, so we need to handle them separately
            const matchesLobby = player?.lobbyId === lobby.value?.$id;
            const isCreateOrUpdate = eventType?.includes('create') || eventType?.includes('update');
            const shouldUpdate = (isCreateOrUpdate && matchesLobby) || isDelete;

            if (shouldUpdate) {
                console.log('🔁 Triggering onPlayersUpdated due to', eventType);
                await onPlayersUpdated?.();
            }
        }
    );

    // Return the unsubscribe functions for cleanup
    const cleanup = () => {
        console.log('🧹 Cleaning up subscriptions...');
        unsubscribeLobby?.();
        unsubscribePlayers?.();
    };

    // Automatically cleanup on unmount
    onUnmounted(cleanup);

    // Return cleanup function for manual cleanup if needed
    // Also return selfLeaving ref so it can be set when the user clicks Leave
    return { 
        cleanup,
        selfLeaving
    };
};

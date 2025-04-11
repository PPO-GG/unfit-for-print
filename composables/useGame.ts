// composables/useGame.ts
import { computed } from 'vue';
import { useUserStore } from '~/stores/userStore';
import type { Lobby } from '~/types/lobby';
import type { Player } from '~/types/player';

export const useGame = (lobby: Ref<Lobby | null>) => {
    const userStore = useUserStore();

    const gameState = computed(() => {
        try {
            return lobby.value ? JSON.parse(lobby.value.gameState) : null;
        } catch {
            return null;
        }
    });

    const currentUserId = computed(() => userStore.user?.$id || '');

    const isJudge = computed(() =>
        gameState.value?.judge === currentUserId.value
    );

    const isPlaying = computed(() =>
        gameState.value?.phase === 'submitting' && !isJudge.value
    );

    const getHand = computed(() => {
        return gameState.value?.hands?.[currentUserId.value] || [];
    });

    const getScore = (userId: string) => {
        return gameState.value?.scores?.[userId] ?? 0;
    };

    const getPlayedCard = (userId: string) => {
        return gameState.value?.playedCards?.[userId] ?? null;
    };

    const hasSubmittedCard = computed(() => {
        return gameState.value?.playedCards?.hasOwnProperty(currentUserId.value) ?? false;
    });

    const canRevealWinner = computed(() => {
        return (
            isJudge.value &&
            gameState.value?.phase === 'judging' &&
            Object.keys(gameState.value.playedCards || {}).length > 0
        );
    });

    const getRemainingPlayers = computed(() => {
        if (!gameState.value) return [];
        const allPlayerIds = Object.keys(gameState.value.hands || {});
        const submittedIds = Object.keys(gameState.value.playedCards || {});
        return allPlayerIds.filter((id) => !submittedIds.includes(id));
    });

    return {
        gameState,
        isJudge,
        isPlaying,
        getHand,
        getScore,
        getPlayedCard,
        hasSubmittedCard,
        canRevealWinner,
        getRemainingPlayers,
    };
};
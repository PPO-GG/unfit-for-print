// composables/useGameContext.ts
import { computed, ref, watch } from 'vue'
import type { Lobby } from '~/types/lobby'
import type { GameState } from '~/types/game'
import { useUserStore } from '~/stores/userStore'

// Decoding JSON safely
function decodeGameState(raw: string | object | null): GameState | null {
    try {
        if (!raw) return null
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        // Ensure the parsed object matches the GameState type
        if (parsed && typeof parsed === 'object' && 'phase' in parsed && 'round' in parsed) {
            return parsed as GameState
        }
        return null
    } catch (err) {
        console.error('Failed to decode game state:', err)
        return null
    }
}

export const useGameContext = (lobby: Ref<Lobby | null>) => {
    const userStore = useUserStore()
    const gameState = ref<GameState | null>(null)

    // Watch for changes in lobby.gameState
    watch(
        () => lobby.value?.gameState,
        (rawState) => {
            if (!rawState) return
            gameState.value = decodeGameState(rawState)
        },
        { immediate: true }
    )

    const phase = computed(() => gameState.value?.phase || null)
    const round = computed(() => gameState.value?.round ?? 0)
    const currentUserId = computed(() => userStore.user?.$id)

    // Phase helpers
    const isWaiting = computed(() => phase.value === 'waiting')
    const isPlaying = computed(() => phase.value === 'submitting')
    const isJudging = computed(() => phase.value === 'judging')
    const isComplete = computed(() => phase.value === 'complete')

    // Role & state
    const isJudge = computed(() => currentUserId.value === gameState.value?.judge)
    const getHand = computed(() => gameState.value?.hands?.[currentUserId.value!] ?? [])
    const getScoreForPlayer = (userId: string) => gameState.value?.scores?.[userId] ?? 0
    const hasSubmittedCard = computed(() =>
        gameState.value?.playedCards?.[currentUserId.value!] !== undefined
    )
    const canRevealWinner = computed(() =>
        isJudge.value &&
        isJudging.value &&
        Object.keys(gameState.value?.playedCards ?? {}).length > 0
    )
    const getPlayedCard = computed(() => gameState.value?.playedCards?.[currentUserId.value!] ?? null)
    const getRemainingPlayers = computed(() => {
        const allPlayers = Object.keys(gameState.value?.players ?? {})
        const played = Object.keys(gameState.value?.playedCards ?? {})
        return allPlayers.filter((id) => !played.includes(id))
    })

    return {
        gameState,
        phase,
        round,
        isWaiting,
        isPlaying,
        isJudging,
        isComplete,
        isJudge,
        getHand,
        getScoreForPlayer,
        hasSubmittedCard,
        canRevealWinner,
        getPlayedCard,
        getRemainingPlayers
    }
}

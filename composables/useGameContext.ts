// composables/useGameContext.ts
import { computed } from 'vue'
import type { Ref } from 'vue'
import type { Lobby } from '~/types/lobby'
import { useGameState } from '~/composables/useGameState'
import { useUserStore } from '~/stores/userStore'

/**
 * Provides reactive access to the decoded game state stored in lobby.gameState
 * and useful computed properties for UI phases, current czar, cards, etc.
 */
export function useGameContext(lobbyRef: Ref<Lobby | null>) {
    const userStore = useUserStore()
    const { decodeGameState } = useGameState()

    // Decode the game state string into a JS object on every change
    const state = computed(() => {
        if (!lobbyRef.value) return null
        return decodeGameState(lobbyRef.value.gameState)
    })

    // Helper: current user ID
    const myId = computed(() => userStore.user?.$id ?? '')

    return {
        state,
        // UI phases
        isWaiting:    computed(() => state.value?.phase === 'waiting'),
        isSubmitting: computed(() => state.value?.phase === 'submitting'),
        isPlaying:    computed(() => {
            // Log the values for debugging
            console.log('[GameContext] Checking isPlaying:', {
                lobbyStatus: lobbyRef.value?.status,
                gamePhase: state.value?.phase
            });
            // Consider all active game phases as "playing"
            const playingPhases = ['submitting', 'judging', 'roundEnd'];
            return lobbyRef.value?.status === 'playing' || 
                   (state.value?.phase && playingPhases.includes(state.value.phase));
        }),
        isJudging:    computed(() => state.value?.phase === 'judging'),
        isComplete:   computed(() => state.value?.phase === 'complete'),

        // Czar info
        czarId:       computed(() => state.value?.czarId ?? null),
        isCzar:       computed(() => myId.value === state.value?.czarId),

        // Black card prompt
        blackCard:    computed(() => state.value?.blackCard ?? null),

        // Submissions map
        submissions:  computed(() => state.value?.submissions ?? {}),
        mySubmission: computed(() => state.value?.submissions?.[myId.value] ?? null),
        otherSubmissions: computed(() => {
            const subs = state.value?.submissions || {}
            return Object.entries(subs)
                .filter(([pid]) => pid !== myId.value)
                .map(([pid, cards]) => ({ playerId: pid, cards }))
        }),

        // Hands map
        hands:        computed(() => state.value?.hands ?? {}),
        myHand:       computed(() => state.value?.hands?.[myId.value] ?? []),

        // Scoring
        scores:       computed(() => state.value?.scores ?? {}),
        leaderboard: computed(() => {
            // scores are stored as Record<playerId, number>
            const sc = (state.value?.scores || {}) as Record<string, number>
            // Typed entries for safe number comparisons
            const entries = Object.entries(sc) as [string, number][]
            return entries
                .map(([pid, pts]) => ({ playerId: pid, points: pts }))
                .sort((a, b) => b.points - a.points)
        }),
    }
}

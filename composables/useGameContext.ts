// composables/useGameContext.ts
import {computed} from 'vue'
import type {Ref} from 'vue'
import type {Lobby} from '~/types/lobby'
import type {GameState, PlayerId, CardId} from '~/types/game'
import {useGameState} from '~/composables/useGameState'
import {useUserStore} from '~/stores/userStore'

const PLAYING_PHASES: GameState['phase'][] = ['submitting', 'judging', 'roundEnd']
const DEFAULT_COUNTDOWN_DURATION = 5

export function useGameContext(
    lobbyRef: Ref<Lobby | null>,
    externalPlayerHands?: Ref<Record<PlayerId, CardId[]>>
) {
    const userStore = useUserStore()
    const {decodeGameState} = useGameState()

    const state = computed<GameState | null>(() => {
        if (!lobbyRef.value) return null
        try {
            return decodeGameState(lobbyRef.value.gameState) as GameState
        } catch (error) {
            console.error('Failed to decode game state:', error)
            return null
        }
    })

    const myId = computed<PlayerId>(() => {
        const id = userStore.user?.$id
        if (!id) {
            console.warn('User ID not available')
            return ''
        }
        return id
    })

    return {
        state,
        // UI phases
        isWaiting: computed(() => state.value?.phase === 'waiting'),
        isSubmitting: computed(() => state.value?.phase === 'submitting'),
        isPlaying: computed(() => {
            if (import.meta.dev) {
                console.log('[GameContext] Checking isPlaying:', {
                    lobbyStatus: lobbyRef.value?.status,
                    gamePhase: state.value?.phase
                })
            }
            return lobbyRef.value?.status === 'playing' ||
                (state.value?.phase && PLAYING_PHASES.includes(state.value.phase))
        }),
        isJudging: computed(() => state.value?.phase === 'judging'),
        isComplete: computed(() => state.value?.phase === 'complete'),
        isRoundEnd: computed(() => state.value?.phase === 'roundEnd'),

        // Judge info
        judgeId: computed((): PlayerId | null => state.value?.judgeId ?? null),
        isJudge: computed(() => myId.value === state.value?.judgeId),

        // Black card prompt
        blackCard: computed(() => state.value?.blackCard ?? null),

        // Submissions map
        submissions: computed((): Record<PlayerId, CardId[]> => state.value?.submissions ?? {}),
        mySubmission: computed((): CardId[] | null => state.value?.submissions?.[myId.value] ?? null),
        otherSubmissions: computed(() => {
            const subs = state.value?.submissions || {}
            return Object.entries(subs)
                .filter(([pid]) => pid !== myId.value)
                .map(([pid, cards]) => ({playerId: pid as PlayerId, cards}))
        }),

        // Hands map
        hands: computed((): Record<PlayerId, CardId[]> => {
            // Use external player hands if provided, otherwise fall back to state.hands
            if (externalPlayerHands?.value) {
                return externalPlayerHands.value;
            }
            return state.value?.hands ?? {};
        }),
        myHand: computed((): CardId[] => {
            // Use external player hands if provided, otherwise fall back to state.hands
            if (externalPlayerHands?.value && myId.value) {
                const cards = externalPlayerHands.value[myId.value] ?? [];

                // If cards array is empty but we know external hands are available,
                // this might be because the player ID in the game cards doesn't match the user ID
                // Let's try to find the player's hand by iterating through all hands
                if (cards.length === 0 && externalPlayerHands.value && Object.keys(externalPlayerHands.value).length > 0) {
                    // Try to find a matching player ID by checking if any player ID contains the current user ID
                    // This handles cases where the player ID might be formatted differently
                    for (const [pid, playerCards] of Object.entries(externalPlayerHands.value)) {
                        if (pid.includes(myId.value) || myId.value.includes(pid)) {
                            return playerCards;
                        }
                    }
                }

                return cards;
            }
            const cards = state.value?.hands?.[myId.value] ?? [];
            return cards;
        }),

        // Scoring
        scores: computed((): Record<PlayerId, number> => state.value?.scores ?? {}),
        leaderboard: computed(() => {
            const scores = state.value?.scores ?? {}
            return Object.entries(scores)
                .map(([pid, points]) => ({
                    playerId: pid as PlayerId,
                    points: points
                }))
                .sort((a, b) => b.points - a.points)
        }),

        // Round End Info
        roundWinner: computed((): PlayerId | undefined => state.value?.roundWinner),
        roundEndStartTime: computed((): number | null => state.value?.roundEndStartTime ?? null),
        roundEndCountdownDuration: computed((): number =>
            lobbyRef.value?.roundEndCountdownDuration ?? DEFAULT_COUNTDOWN_DURATION
        ),
        myId,
    }
}

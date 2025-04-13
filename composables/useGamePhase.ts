//composables/useGamePhase.ts
export const useGamePhase = (phase: Ref<string | null | undefined>) => {
    return {
        isWaiting: computed(() => phase.value === 'waiting'),
        isPlaying: computed(() => phase.value === 'submitting'),
        isJudging: computed(() => phase.value === 'judging'),
        isComplete: computed(() => phase.value === 'complete'),
    };
};

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useGameActions } from '~/composables/useGameActions';

const props = defineProps<{
  lobbyId: string; // Need lobbyId to call startNextRound
  winnerName: string | null;
  isWinnerSelf: boolean;
  countdownDuration: number; // In seconds
  startTime: number | null; // Server timestamp (ms) when roundEnd started
  isHost: boolean;
}>();

const { startNextRound } = useGameActions();

const remainingTime = ref(props.countdownDuration);
const timerInterval = ref<NodeJS.Timeout | null>(null);
const hasTriggeredNextRound = ref(false); // Prevent multiple calls

const winnerMessage = computed(() => {
  if (props.isWinnerSelf) {
    return "🎉 You won this round! 🎉";
  } else if (props.winnerName) {
    return `🏆 ${props.winnerName} Won this round! 🏆`;
  } else {
    // Handle potential ties or missing winner info gracefully
    return "Round Over!";
  }
});

const updateTimer = () => {
  if (!props.startTime) {
    remainingTime.value = 0; // Or show default if startTime is null
    return;
  }

  const now = Date.now();
  const elapsed = now - props.startTime;
  const remainingMs = (props.countdownDuration * 1000) - elapsed;
  remainingTime.value = Math.max(0, Math.ceil(remainingMs / 1000));

  // Trigger next round when timer hits 0 (only for host)
  if (remainingTime.value <= 0 && props.isHost && !hasTriggeredNextRound.value) {
    hasTriggeredNextRound.value = true; // Set flag immediately
    console.log(`[Host] Countdown finished for lobby ${props.lobbyId}. Triggering next round.`);

    // Add a 500ms buffer to ensure the server-side countdown is complete
    setTimeout(() => {
      console.log(`[Host] Buffer time elapsed, now calling startNextRound for lobby ${props.lobbyId}`);
      startNextRound(props.lobbyId)
        .catch((err: unknown) => { // Explicitly type err as unknown
          console.error("Failed to trigger next round:", err);
          // Optionally reset flag if call fails and needs retry?
          // hasTriggeredNextRound.value = false;
        });
    }, 500); // 500ms buffer

    if (timerInterval.value) {
      clearInterval(timerInterval.value); // Stop timer once triggered
    }
  }
};
const remainingTimeProgress = ref(remainingTime.value || 0)
onMounted(() => {
  hasTriggeredNextRound.value = false; // Reset flag on mount
  updateTimer(); // Initial calculation
  timerInterval.value = setInterval(updateTimer, 1000); // Update every second
});

onUnmounted(() => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
  }
});

// Watch for startTime changes (e.g., if component persists across rounds somehow)
watch(() => props.startTime, () => {
  hasTriggeredNextRound.value = false; // Reset flag if start time changes
  updateTimer(); // Recalculate immediately
  if (timerInterval.value) clearInterval(timerInterval.value); // Clear old interval
  timerInterval.value = setInterval(updateTimer, 1000); // Start new interval
});

</script>

<template>
  <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
    <div class="bg-slate-800 p-8 rounded-lg shadow-xl text-center max-w-md w-full">
      <h2 class="text-3xl font-bold mb-4 text-yellow-400 font-['Bebas_Neue']">
        {{ winnerMessage }}
      </h2>
      <p class="text-6xl font-bold text-white mb-6 font-['Bebas_Neue']">
        {{ remainingTime }}
      </p>
      <p class="text-lg text-slate-300 font-['Bebas_Neue']">
        Next round starting soon...
      </p>
      <!-- Optional: Add a visual timer bar -->
      <div class="w-full bg-slate-700 rounded-full h-2.5 mt-4 font-['Bebas_Neue']">
	      <UProgress v-model="remainingTimeProgress" />
<!--        <div class="bg-blue-600 h-2.5 rounded-full font-['Bebas_Neue']" :style="{ width: `${(remainingTime / countdownDuration) * 100}%` }"></div>-->
      </div>
    </div>
  </div>
</template>
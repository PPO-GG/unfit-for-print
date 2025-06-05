<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useGameActions } from '~/composables/useGameActions';
import whiteCard from '~/components/game/whiteCard.vue';

const { t } = useI18n();

// Debug function to log props
function logDebugInfo() {
  console.log('RoundEndOverlay props:', {
    winningCards: props.winningCards,
    roundWinner: props.winnerName,
    isWinnerSelf: props.isWinnerSelf
  });
}
const props = defineProps<{
	lobbyId: string;
	winnerName: string | null;
	isWinnerSelf: boolean;
	countdownDuration: number;
	startTime: number | null;
	isHost: boolean;
	documentId?: string;
	winningCards?: string[];
}>();

const { startNextRound } = useGameActions();

const remainingTime = ref(props.countdownDuration);
const timerInterval = ref<NodeJS.Timeout | null>(null);
const hasTriggeredNextRound = ref(false);
const retryFailed = ref(false);
const isRetrying = ref(false);

const winnerMessage = computed(() => {
	if (props.isWinnerSelf) {
		return t('game.round_won_self');
	} else if (props.winnerName) {
		return t('game.round_won_other', { name: props.winnerName });
	} else {
		return t('game.round_over');
	}
});

// Get winning cards from props, ensuring we have a valid array
const effectiveWinningCards = computed(() => {
	// If winning cards are provided and not empty, use them
	if (props.winningCards && Array.isArray(props.winningCards) && props.winningCards.length > 0) {
		console.log('Using provided winning cards:', props.winningCards);
		return props.winningCards;
	}

	// Otherwise, return an empty array to prevent null reference errors
	console.log('No winning cards available, returning empty array');
	return [];
});

// Compute progress percentage for UProgress
const progressPercentage = computed(() => {
	return (remainingTime.value / props.countdownDuration) * 100;
});

const updateTimer = () => {
	if (!props.startTime) {
		remainingTime.value = 0;
		return;
	}

	const now = Date.now();
	const elapsed = now - props.startTime;
	const remainingMs = props.countdownDuration * 1000 - elapsed;
	remainingTime.value = Math.max(0, Math.ceil(remainingMs / 1000));

	if (remainingTime.value <= 0 && props.isHost && !hasTriggeredNextRound.value) {
		hasTriggeredNextRound.value = true;
		retryFailed.value = false;
		isRetrying.value = true;

 	// Add a shorter delay before calling startNextRound
		setTimeout(() => {
			console.log("Attempting to start next round for lobby:", props.lobbyId);
			startNextRound(props.lobbyId, props.documentId)
				.then((result) => {
					console.log("Start next round result:", result);
					if (result && result.success) {
						console.log("Successfully started next round");
						isRetrying.value = false;
					} else {
						// console.warn("Start next round returned unsuccessful result:", result);
						// If the first attempt returns unsuccessful (not an error), retry after a delay
						setTimeout(() => {
							// console.log("Retrying startNextRound after initial unsuccessful result");
							isRetrying.value = true;
							startNextRound(props.lobbyId, props.documentId)
								.then((retryResult) => {
									// console.log("Retry result:", retryResult);
									if (retryResult && retryResult.success) {
										// console.log("Successfully started next round on retry");
										isRetrying.value = false;
									} else {
										// console.warn("Retry also returned unsuccessful result");
										retryFailed.value = true;
										isRetrying.value = false;
									}
								})
								.catch((retryErr) => {
									// console.error("Failed to trigger next round on retry:", retryErr);
									retryFailed.value = true;
									isRetrying.value = false;
								});
						}, 2000); // Wait 2 seconds before retrying
					}
				})
				.catch((err) => {
					console.error("Failed to trigger next round:", err);

					// If the first attempt fails with an error, retry after a delay
					setTimeout(() => {
						// console.log("Retrying startNextRound after initial error");
						isRetrying.value = true;
						startNextRound(props.lobbyId, props.documentId)
							.then((retryResult) => {
								if (retryResult && retryResult.success) {
									// console.log("Successfully started next round on retry after error");
									isRetrying.value = false;
								} else {
									// console.warn("Retry after error returned unsuccessful result");
									retryFailed.value = true;
									isRetrying.value = false;
								}
							})
							.catch((retryErr) => {
								console.error("Failed to trigger next round on retry after error:", retryErr);
								retryFailed.value = true;
								isRetrying.value = false;
							});
					}, 2000); // Wait 2 seconds before retrying
				});
		}, 1000); // Reduced from 1500ms to 1000ms

		// Don't clear the interval immediately, let it continue running
		// We'll only clear it when we successfully move to the next round
	}
};

onMounted(() => {
	hasTriggeredNextRound.value = false;
	updateTimer();
	timerInterval.value = setInterval(updateTimer, 1000);

	// Log debug info when component mounts
	logDebugInfo();
});

onUnmounted(() => {
	if (timerInterval.value) {
		clearInterval(timerInterval.value);
	}
});

// Function to manually retry starting the next round
const manualRetry = () => {
	if (!props.isHost) return;

	retryFailed.value = false;
	isRetrying.value = true;

	startNextRound(props.lobbyId, props.documentId).catch((err: unknown) => {
		console.error("Failed to manually trigger next round:", err);
		retryFailed.value = true;
		isRetrying.value = false;
	}).then((result) => {
		if (result && result.success) {
			isRetrying.value = false;
		}
	});
};

// Function to refresh the page as a last resort
const refreshPage = () => {
	window.location.reload();
};

watch(() => props.startTime, () => {
	hasTriggeredNextRound.value = false;
	retryFailed.value = false;
	isRetrying.value = false;
	updateTimer();
	if (timerInterval.value) clearInterval(timerInterval.value);
	timerInterval.value = setInterval(updateTimer, 1000);
});

// Watch for changes to winningCards prop
watch(() => props.winningCards, (newCards) => {
	console.log('winningCards changed:', newCards);
	console.log('winningCards type:', typeof newCards, Array.isArray(newCards));
	if (newCards && Array.isArray(newCards)) {
		console.log('winningCards length:', newCards.length);
		console.log('winningCards content:', JSON.stringify(newCards));
	}
	logDebugInfo();
}, { immediate: true });

// Watch for changes to effectiveWinningCards computed property
watch(() => effectiveWinningCards.value, (newCards) => {
	console.log('effectiveWinningCards changed:', newCards);
	if (newCards && Array.isArray(newCards)) {
		console.log('effectiveWinningCards length:', newCards.length);
		console.log('effectiveWinningCards content:', JSON.stringify(newCards));
	}
}, { immediate: true });
</script>

<template>
	<div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
		<div class="bg-slate-800 p-8 rounded-lg shadow-xl text-center max-w-md w-full outline-2 outline-yellow-400 outline-offset-4">
			<h2 class="text-5xl font-bold mb-4 text-yellow-400 font-['Bebas_Neue']">
				{{ winnerMessage }}
			</h2>

   <!-- Display winning card if available -->
   <div v-if="effectiveWinningCards && Array.isArray(effectiveWinningCards) && effectiveWinningCards.length > 0" class="flex justify-center mb-6 mt-4">
   	<div class="inline-flex items-center justify-center gap-2">
   		<!-- Only display the first card (the winning card) -->
   		<whiteCard
   			:cardId="effectiveWinningCards[0]"
   			:is-winner="true"
   			:flipped="false"
   		/>
   	</div>
   </div>
   <!-- Debug info for winning cards -->
   <div v-else class="text-red-500 text-sm">
   	{{ console.log('Winning cards not displayed:', {
   		winningCards: props.winningCards,
   		effectiveWinningCards,
   		condition: effectiveWinningCards && Array.isArray(effectiveWinningCards) && effectiveWinningCards.length > 0
   	}) }}
   	<p v-if="!effectiveWinningCards || !Array.isArray(effectiveWinningCards)">No winning cards available</p>
   	<p v-else-if="effectiveWinningCards.length === 0">Winning cards array is empty</p>
   </div>
			<!-- Timer removed as it was showing 0 and not accurate -->

			<!-- Different messages based on state -->
			<div v-if="!retryFailed && !isRetrying">
				<p class="text-lg text-slate-300 font-['Bebas_Neue']">
					{{ t('game.next_round_starting_soon') }}
				</p>
				<div class="w-full bg-slate-700 rounded-full h-2.5 mt-4 font-['Bebas_Neue']">
					<UProgress indeterminate color="warning" />
				</div>
			</div>

			<div v-else-if="isRetrying">
				<p class="text-lg text-slate-300 font-['Bebas_Neue']">
					{{ t('game.attempting_to_start_next_round') || 'Attempting to start next round...' }}
				</p>
				<div class="w-full bg-slate-700 rounded-full h-2.5 mt-4 font-['Bebas_Neue']">
					<UProgress indeterminate color="warning" />
				</div>
			</div>

			<div v-else-if="retryFailed">
				<p class="text-lg text-slate-300 font-['Bebas_Neue'] mb-4">
					{{ t('game.failed_to_start_next_round') || 'Failed to start next round' }}
				</p>

				<!-- Retry options -->
				<div class="flex flex-col gap-3">
					<UButton v-if="props.isHost" @click="manualRetry" color="warning" block>
						{{ t('game.retry') || 'Retry' }}
					</UButton>
					<UButton @click="refreshPage" color="gray" block>
						{{ t('game.refresh_page') || 'Refresh Page' }}
					</UButton>
				</div>
			</div>
		</div>
	</div>
</template>

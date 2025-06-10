<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useGameActions } from '~/composables/useGameActions';
import whiteCard from '~/components/game/whiteCard.vue';

const { t } = useI18n();

// Function to log props (commented out for production)
function logDebugInfo() {
  // Debug logging removed for production
}
const props = withDefaults(defineProps<{
	lobbyId: string;
	winnerName: string | null;
	isWinnerSelf: boolean;
	countdownDuration: number;
	startTime: number | null;
	isHost: boolean;
	documentId?: string;
	winningCards?: string[];
}>(), {
	isWinnerSelf: false,
	isHost: false
});

// Extract startNextRound function from useGameActions
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
		return props.winningCards;
	}

	// Otherwise, return an empty array to prevent null reference errors
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
		console.log("Timer expired, host is triggering next round automatically");
		console.log("Host status:", props.isHost);
		console.log("Lobby ID:", props.lobbyId);
		console.log("Document ID:", props.documentId);

		// Ensure we have a valid lobby ID
		if (!props.lobbyId) {
			console.error("No lobby ID provided, cannot start next round");
			return;
		}

		hasTriggeredNextRound.value = true;
		retryFailed.value = false;
		isRetrying.value = true;

 		// Add a shorter delay before calling startNextRound
		setTimeout(() => {
			console.log("Calling startNextRound with:", { lobbyId: props.lobbyId, documentId: props.documentId });

			startNextRound(props.lobbyId, props.documentId)
				.then((result) => {
					console.log("Auto start next round result:", result);
					if (result && result.success) {
						console.log("Successfully started next round automatically");
						isRetrying.value = false;
					} else {
						console.warn("Auto start next round returned unsuccessful result:", result);
						// If the first attempt returns unsuccessful (not an error), retry after a delay
						setTimeout(() => {
							console.log("Retrying startNextRound after initial unsuccessful result");
							isRetrying.value = true;
							startNextRound(props.lobbyId, props.documentId)
								.then((retryResult) => {
									console.log("Auto retry result:", retryResult);
									if (retryResult && retryResult.success) {
										console.log("Successfully started next round on auto retry");
										isRetrying.value = false;
									} else {
										console.warn("Auto retry also returned unsuccessful result");
										retryFailed.value = true;
										isRetrying.value = false;
									}
								})
								.catch((retryErr) => {
									console.error("Failed to trigger next round on auto retry:", retryErr);
									retryFailed.value = true;
									isRetrying.value = false;
								});
						}, 2000); // Wait 2 seconds before retrying
					}
				})
				.catch((err) => {
					console.error("Failed to trigger next round automatically:", err);

					// If the first attempt fails with an error, retry after a delay
					setTimeout(() => {
						console.log("Retrying startNextRound after initial error");
						isRetrying.value = true;
						startNextRound(props.lobbyId, props.documentId)
							.then((retryResult) => {
								console.log("Auto retry after error result:", retryResult);
								if (retryResult && retryResult.success) {
									console.log("Successfully started next round on auto retry after error");
									isRetrying.value = false;
								} else {
									console.warn("Auto retry after error returned unsuccessful result");
									retryFailed.value = true;
									isRetrying.value = false;
								}
							})
							.catch((retryErr) => {
								console.error("Failed to trigger next round on auto retry after error:", retryErr);
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
	console.log("RoundEndOverlay mounted");
	console.log("Props:", {
		lobbyId: props.lobbyId,
		documentId: props.documentId,
		isHost: props.isHost,
		isWinnerSelf: props.isWinnerSelf,
		winningCards: props.winningCards
	});

	hasTriggeredNextRound.value = false;
	updateTimer();
	timerInterval.value = setInterval(updateTimer, 1000);

	// Add a direct call to startNextRound after a delay if we're the host
	// This is a temporary fix to ensure the game progresses
	if (props.isHost) {
		console.log("Host detected, will attempt direct call to startNextRound after delay");

		setTimeout(() => {
			if (!hasTriggeredNextRound.value) {
				console.log("Attempting direct call to startNextRound");
				console.log("Lobby ID:", props.lobbyId);
				console.log("Document ID:", props.documentId);

				// Ensure we have a valid lobby ID
				if (!props.lobbyId) {
					console.error("No lobby ID provided for direct call, cannot start next round");
					return;
				}

				startNextRound(props.lobbyId, props.documentId)
					.then((result) => {
						console.log("Direct call to startNextRound result:", result);
						if (result && result.success) {
							console.log("Successfully started next round via direct call");
						} else {
							console.warn("Direct call to startNextRound returned unsuccessful result:", result);
						}
					})
					.catch((err) => {
						console.error("Failed to directly trigger next round:", err);
					});
			} else {
				console.log("Next round already triggered, skipping direct call");
			}
		}, 5000); // Wait 5 seconds before trying
	} else {
		console.log("Not host, skipping direct call to startNextRound");
	}
});

onUnmounted(() => {
	if (timerInterval.value) {
		clearInterval(timerInterval.value);
	}
});

// Function to manually retry starting the next round
const manualRetry = () => {
	console.log("Manual retry called, checking host status:", props.isHost);
	console.log("Lobby ID:", props.lobbyId);
	console.log("Document ID:", props.documentId);

	if (!props.isHost) {
		console.warn("Not host, cannot trigger next round");
		return;
	}

	retryFailed.value = false;
	isRetrying.value = true;

	// Ensure we have a valid lobby ID
	if (!props.lobbyId) {
		console.error("No lobby ID provided, cannot start next round");
		retryFailed.value = true;
		isRetrying.value = false;
		return;
	}

	console.log("Calling startNextRound with:", { lobbyId: props.lobbyId, documentId: props.documentId });

	startNextRound(props.lobbyId, props.documentId)
		.then((result) => {
			console.log("Manual retry result:", result);
			if (result && result.success) {
				console.log("Successfully started next round");
				isRetrying.value = false;
			} else {
				console.warn("Failed to start next round:", result);
				retryFailed.value = true;
				isRetrying.value = false;
			}
		})
		.catch((err: unknown) => {
			console.error("Failed to manually trigger next round:", err);
			retryFailed.value = true;
			isRetrying.value = false;
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

// Watch for changes to props and computed properties (debug watches removed for production)
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
   <!-- Fallback message if no winning cards are available -->
   <div v-else class="text-gray-500 text-sm">
   	<p>{{ t('game.no_winning_cards') || 'No winning cards available' }}</p>
   </div>
			<!-- Timer removed as it was showing 0 and not accurate -->

			<!-- Host-only manual next round button -->
			<div v-if="props.isHost" class="mb-6 mt-4">
				<UButton 
					@click="manualRetry" 
					color="primary" 
					size="lg" 
					block
					:loading="isRetrying"
					:disabled="isRetrying"
					class="font-['Bebas_Neue'] text-xl"
				>
					{{ t('game.start_next_round') || 'Start Next Round Manually' }}
				</UButton>
			</div>

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

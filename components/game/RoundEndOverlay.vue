<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useGameActions } from '~/composables/useGameActions';

const { t } = useI18n();
const props = defineProps<{
	lobbyId: string;
	winnerName: string | null;
	isWinnerSelf: boolean;
	countdownDuration: number;
	startTime: number | null;
	isHost: boolean;
	documentId?: string;
}>();

const { startNextRound } = useGameActions();

const remainingTime = ref(props.countdownDuration);
const timerInterval = ref<NodeJS.Timeout | null>(null);
const hasTriggeredNextRound = ref(false);

const winnerMessage = computed(() => {
	if (props.isWinnerSelf) {
		return t('game.round_won_self');
	} else if (props.winnerName) {
		return t('game.round_won_other', { name: props.winnerName });
	} else {
		return t('game.round_over');
	}
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

		// Add a longer delay before calling startNextRound to ensure the server's timer has also expired
		setTimeout(() => {
			startNextRound(props.lobbyId, props.documentId).catch((err: unknown) => {
				console.error("Failed to trigger next round:", err);
				// If the first attempt fails, try again after a longer delay
				setTimeout(() => {
					if (hasTriggeredNextRound.value) {
						console.log("Retrying startNextRound after initial failure");
						startNextRound(props.lobbyId, props.documentId).catch((retryErr: unknown) => {
							console.error("Failed to trigger next round on retry:", retryErr);
						});
					}
				}, 2000);
			});
		}, 1000);

		if (timerInterval.value) {
			clearInterval(timerInterval.value);
		}
	}
};

onMounted(() => {
	hasTriggeredNextRound.value = false;
	updateTimer();
	timerInterval.value = setInterval(updateTimer, 1000);
});

onUnmounted(() => {
	if (timerInterval.value) {
		clearInterval(timerInterval.value);
	}
});

watch(() => props.startTime, () => {
	hasTriggeredNextRound.value = false;
	updateTimer();
	if (timerInterval.value) clearInterval(timerInterval.value);
	timerInterval.value = setInterval(updateTimer, 1000);
});
</script>

<template>
	<div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
		<div class="bg-slate-800 p-8 rounded-lg shadow-xl text-center max-w-md w-full outline-2 outline-yellow-400 outline-offset-4">
			<h2 class="text-5xl font-bold mb-4 text-yellow-400 font-['Bebas_Neue']">
				{{ winnerMessage }}
			</h2>
			<p class="text-6xl font-bold text-white mb-6 font-['Bebas_Neue']">
				{{ remainingTime }}
			</p>
			<p class="text-lg text-slate-300 font-['Bebas_Neue']">
				{{ t('game.next_round_starting_soon') }}
			</p>
			<div class="w-full bg-slate-700 rounded-full h-2.5 mt-4 font-['Bebas_Neue']">
				<UProgress :value="progressPercentage" color="warning" />
			</div>
		</div>
	</div>
</template>

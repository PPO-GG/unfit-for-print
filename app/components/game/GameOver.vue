<script lang="ts" setup>
import type { Player } from "~/types/player";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import { useNotifications } from "~/composables/useNotifications";
import { useSfx } from "~/composables/useSfx";
import { SFX } from "~/config/sfx.config";

interface LeaderboardEntry {
  playerId: string;
  points: number;
}

const props = defineProps<{
  leaderboard: LeaderboardEntry[];
  players: Player[];
}>();

const emit = defineEmits(["continue"]);
const { t } = useI18n();
const { markPlayerReturnedToLobby } = useLobby();
const userStore = useUserStore();
const { notify } = useNotifications();

// Get the current user ID
const myId = computed(() => userStore.user?.$id || "");
const { playSfx } = useSfx();

// Auto-return timer
const autoReturnTimeRemaining = ref(60); // 60 seconds countdown
const autoReturnInterval = ref<number | null>(null);

// Start the auto-return timer when the component is mounted
onMounted(() => {
  playSfx(SFX.winGame, { volume: 0.8 });
  startAutoReturnTimer();
});

// Clean up the interval when the component is unmounted
onUnmounted(() => {
  if (autoReturnInterval.value) {
    window.clearInterval(autoReturnInterval.value);
  }
});

// Function to start the auto-return timer
const startAutoReturnTimer = () => {
  // Set the initial time
  autoReturnTimeRemaining.value = 60;

  // Clear any existing interval
  if (autoReturnInterval.value) {
    window.clearInterval(autoReturnInterval.value);
  }

  // Set up a new interval to count down every second
  autoReturnInterval.value = window.setInterval(() => {
    autoReturnTimeRemaining.value--;

    // When timer reaches 0, automatically return to the lobby
    if (autoReturnTimeRemaining.value <= 0) {
      handleContinue();
      window.clearInterval(autoReturnInterval.value!);
    }
  }, 1000);
};

// Function to handle the continue button click
const handleContinue = async () => {
  // Get the lobby ID from the first player (all players should have the same lobby ID)
  const lobbyId = props.players[0]?.lobbyId;

  if (!lobbyId || !myId.value) return;

  try {
    // Mark this player as returned to the lobby
    await markPlayerReturnedToLobby(lobbyId, myId.value);

    // Show notification
    notify({
      title: t("lobby.return_to_lobby"),
      description: t("lobby.scoreboard_return_description"),
      color: "success",
      icon: "i-mdi-check-circle",
    });

    // Emit the continue event to the parent component
    emit("continue");
  } catch (err) {
    console.error("Failed to return to lobby:", err);
    notify({
      title: t("lobby.failed_return_to_lobby"),
      color: "error",
      icon: "i-mdi-alert-circle",
    });
  }
};

// Helper function to get player name from ID
const getPlayerName = (playerId: string) => {
  // First try to find the player in the props.players array by userId
  const playerByUserId = props.players.find(
    (p: Player) => p.userId === playerId,
  );
  if (playerByUserId?.name) {
    return playerByUserId.name;
  }

  // Then try to find the player in the props.players array by $id
  const playerById = props.players.find((p: Player) => p.$id === playerId);
  if (playerById?.name) {
    return playerById.name;
  }

  return t("lobby.unknown_player");
};
</script>

<template>
  <div class="flex-1 max-w-4xl mx-auto py-8 px-4">
    <h2 class="text-3xl font-bold text-center mb-6">
      {{ t("game.game_over") }}
    </h2>

    <!-- Auto-return timer -->
    <div class="bg-slate-700 rounded-lg p-4 mb-6 text-center">
      <p class="text-4xl font-bold text-white">
        {{ t("lobby.returning_in", { seconds: autoReturnTimeRemaining }) }}
      </p>
    </div>

    <!-- Winner display -->
    <div class="bg-slate-800 rounded-lg p-6 mb-8 text-center">
      <h3 class="text-2xl font-bold mb-4">{{ t("game.winner") }}</h3>
      <div v-if="leaderboard.length > 0" class="flex flex-col items-center">
        <div class="text-yellow-400 text-5xl mb-2">🏆</div>
        <div class="text-2xl font-bold text-yellow-400">
          {{ getPlayerName(leaderboard[0]?.playerId ?? "") }}
        </div>
        <div class="text-xl mt-2">
          {{ leaderboard[0]?.points }} {{ t("game.points") }}
        </div>
      </div>
    </div>

    <!-- Leaderboard -->
    <div class="bg-slate-800 rounded-lg p-6 mb-8">
      <h3 class="text-xl font-bold mb-4 text-center">
        {{ t("game.final_scores") }}
      </h3>
      <div class="space-y-2">
        <div
          v-for="(entry, index) in leaderboard"
          :key="entry.playerId"
          :class="index === 0 ? 'bg-yellow-900/30' : 'bg-slate-700/50'"
          class="flex justify-between items-center p-2 rounded"
        >
          <div class="flex items-center">
            <span class="w-8 text-center">{{ index + 1 }}</span>
            <span>{{ getPlayerName(entry.playerId) }}</span>
          </div>
          <span class="font-bold">{{ entry.points }} pts</span>
        </div>
      </div>
    </div>

    <!-- Continue button -->
    <div class="text-center mt-8">
      <UButton
        color="primary"
        icon="i-solar-multiple-forward-right-bold-duotone"
        size="lg"
        @click="handleContinue"
      >
        {{ t("game.continue_to_lobby") }}
      </UButton>
    </div>
  </div>
</template>

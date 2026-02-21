<script lang="ts" setup>
import type { Player } from "~/types/player";
import type { GameState } from "~/types/game";

const props = defineProps<{
  state: GameState;
  isSubmitting: boolean;
  isJudging: boolean;
  judgeId?: string | null;
  players: Player[];
}>();

const { t } = useI18n();

// Helper function to get player name from ID
const getPlayerName = (playerId: string) => {
  if (!playerId) return t("lobby.unknown_player");

  // First try to find the player in the props.players array by userId
  const playerByUserId = (props.players as Player[]).find(
    (p: Player) => p.userId === playerId,
  );
  if (playerByUserId?.name) {
    return playerByUserId.name;
  }

  // Then try to find the player in the props.players array by $id
  const playerById = (props.players as Player[]).find(
    (p: Player) => p.$id === playerId,
  );
  if (playerById?.name) {
    return playerById.name;
  }

  return t("lobby.unknown_player");
};
</script>

<template>
  <header
    class="flex justify-between items-center backdrop-blur-xs p-8 border-b border-slate-700/30"
  >
    <!-- Floating centre pill -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 glass-panel px-6 py-3 rounded-b-2xl shadow-xl ring-1 ring-violet-500/20"
    >
      <div class="text-center">
        <!-- Round counter -->
        <h2 class="font-display text-3xl leading-none">
          {{ t("game.round") }}
          <span class="text-violet-400">{{ state?.round || 1 }}</span>
        </h2>

        <!-- Phase label -->
        <p class="font-display text-xl leading-none mt-0.5">
          <span
            :class="[
              isSubmitting
                ? 'text-violet-300'
                : isJudging
                  ? 'text-amber-300'
                  : 'text-slate-400',
            ]"
          >
            {{
              isSubmitting
                ? t("game.phase_submission")
                : isJudging
                  ? t("game.phase_judging")
                  : t("game.waiting")
            }}
          </span>
        </p>

        <!-- Judge name -->
        <p
          v-if="judgeId"
          class="font-display text-lg leading-none mt-0.5 text-amber-400"
        >
          <Icon name="mdi:gavel" class="align-middle mr-0.5" />
          {{ t("game.judge", { name: getPlayerName(judgeId) }) }}
        </p>
      </div>
    </div>
  </header>
</template>

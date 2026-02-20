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
    class="flex justify-between items-center backdrop-blur-xs p-8 border-b-1 border-slate-700/50"
  >
    <div
      class="absolute top-0 left-1/2 transform -translate-x-1/2 bg-slate-700 px-4 py-2 rounded-b-xl shadow-lg"
    >
      <div class="text-center">
        <h2 class="font-['Bebas_Neue'] text-3xl">
          {{ t("game.round") }}
          <span class="text-success-300">{{ state?.round || 1 }}</span>
        </h2>
        <p class="text-slate-300 font-['Bebas_Neue'] text-2xl">
          {{
            isSubmitting
              ? t("game.phase_submission")
              : isJudging
                ? t("game.phase_judging")
                : t("game.waiting")
          }}
        </p>
        <p v-if="judgeId" class="text-amber-400 font-['Bebas_Neue'] text-xl">
          {{ t("game.judge", { name: getPlayerName(judgeId) }) }}
        </p>
      </div>
    </div>
  </header>
</template>

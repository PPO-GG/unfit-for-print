<script lang="ts" setup>
import type { Player } from "~/types/player";

interface BlackCard {
  id: string;
  text: string;
  pick: number;
  [key: string]: unknown;
}

const props = withDefaults(
  defineProps<{
    isJudge: boolean;
    submissions: Record<string, string[]>;
    myId: string;
    blackCard?: BlackCard | null;
    myHand?: string[];
    isParticipant: boolean;
    isSpectator: boolean;
    isHost: boolean;
    players: Player[];
  }>(),
  {
    blackCard: null,
    myHand: () => [],
  },
);

const emit = defineEmits(["select-cards", "convert-to-player"]);

const { t } = useI18n();

// Helper function to get player name from ID
const getPlayerName = (playerId: string) => {
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

function handleCardSubmit(cardIds: string[]) {
  emit("select-cards", cardIds);
}

function convertToPlayer(playerId: string) {
  emit("convert-to-player", playerId);
}
</script>

<template>
  <div class="w-full flex flex-col items-center">
    <!-- Judge View -->
    <div v-if="isJudge" class="text-center">
      <p class="uppercase font-['Bebas_Neue'] text-4xl font-bold">
        {{ t("game.you_are_judge") }}
      </p>
      <p class="text-slate-400 font-['Bebas_Neue'] font-light">
        {{ t("game.waiting_for_submissions") }}
      </p>
      <!-- See who already submitted -->
      <div
        v-if="Object.keys(submissions).length > 0"
        class="max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent mt-6"
      >
        <div
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6"
        >
          <div
            v-for="playerId in Object.keys(submissions)"
            :key="playerId"
            class="p-4 md:p-6 outline-2 outline-green-900 bg-slate-800 rounded-xl shadow-md text-center"
          >
            <p
              class="font-bold text-white uppercase font-['Bebas_Neue'] text-2xl md:text-3xl truncate"
            >
              {{ getPlayerName(playerId) }}
            </p>
            <p
              class="text-green-500 uppercase font-['Bebas_Neue'] text-lg md:text-xl font-medium"
            >
              {{ t("game.player_submitted") }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Player View -->
    <div v-else>
      <!-- Player has submitted -->
      <div v-if="submissions[myId]" class="text-center">
        <p class="uppercase font-['Bebas_Neue'] text-4xl font-bold">
          {{ t("game.you_submitted") }}
        </p>
        <div
          class="flex flex-wrap justify-center gap-4 max-h-[40vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent p-2"
        >
          <WhiteCard
            v-for="cardId in submissions[myId]"
            :key="cardId"
            :cardId="cardId"
          />
        </div>
        <p class="mt-4 italic text-gray-500">
          {{ t("game.waiting_for_submissions") }}
        </p>
      </div>

      <!-- Participant view with UserHand -->
      <div
        v-if="blackCard && isParticipant && !submissions[myId]"
        class="w-full flex justify-center items-end bottom-0 fixed translate-x-[-50%] z-50"
      >
        <UserHand
          :cards="myHand"
          :cardsToSelect="blackCard?.pick || 1"
          :disabled="isJudge || false"
          @select-cards="handleCardSubmit"
        />
      </div>

      <!-- Spectator view with message -->
      <div
        v-if="blackCard && isSpectator"
        class="w-full flex justify-center mt-8"
      >
        <div
          class="spectator-message bg-slate-800 p-6 rounded-xl text-center max-w-md"
        >
          <p class="text-xl mb-4">{{ t("game.you_are_spectating") }}</p>
          <!-- Only show this button to the host -->
          <UButton
            v-if="isHost"
            color="primary"
            icon="i-mdi-account-plus"
            @click="convertToPlayer(myId)"
          >
            {{ t("game.convert_to_participant") }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

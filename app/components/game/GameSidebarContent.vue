<script lang="ts" setup>
import type { Player } from "~/types/player";
import type { GameSettings } from "~/types/gamesettings";
import type { GameState } from "~/types/game";

const { t } = useI18n();

const props = defineProps<{
  lobby: { code?: string; hostUserId?: string; $id?: string } & Record<
    string,
    any
  >;
  players: Player[];
  state: GameState | null;
  gameSettings: GameSettings | null;
  isHost: boolean;
  isStarting: boolean;
  isWaiting: boolean;
  joinedLobby: boolean;
  myId: string;
  copied: boolean;
  mobile?: boolean;
}>();

const emit = defineEmits<{
  (e: "copy-link"): void;
  (e: "leave"): void;
  (e: "start-game"): void;
  (e: "convert-spectator", playerId: string): void;
  (e: "skip-player", playerId: string): void;
  (e: "update:settings", settings: GameSettings): void;
  (e: "close"): void;
}>();

// Bot management — create reactive refs from props for the composable
const lobbyRef = computed(() => (props.lobby as any) ?? null);
const playersRef = computed(() => props.players);
const isHostRef = computed(() => props.isHost);
const { botPlayers, canAddBot, addingBot, botError, addBot } = useBots(
  lobbyRef,
  playersRef,
  isHostRef,
);
</script>

<template>
  <!-- Mobile header -->
  <div v-if="mobile" class="flex justify-between items-center">
    <h2 class="font-['Bebas_Neue'] text-2xl">
      {{ t("game.game_menu") }}
    </h2>
    <UButton
      icon="i-solar-close-square-bold-duotone"
      color="neutral"
      variant="ghost"
      size="xl"
      :aria-label="t('game.close_menu')"
      @click="emit('close')"
    />
  </div>

  <!-- Lobby code bar -->
  <div
    class="font-['Bebas_Neue'] text-2xl rounded-xl shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600"
    :class="mobile ? 'p-4' : 'xl:p-4 lg:p-2'"
  >
    <span :class="mobile ? 'items-center flex' : 'items-center hidden sm:flex'">
      {{ t("lobby.lobby_code") }}:
    </span>

    <UFieldGroup v-if="!mobile">
      <UButton
        class="text-slate-100 text-xl ml-2"
        :color="copied ? 'success' : 'secondary'"
        :icon="
          copied
            ? 'i-solar-clipboard-check-bold-duotone'
            : 'i-solar-copy-bold-duotone'
        "
        variant="subtle"
        :aria-label="t('lobby.copy_to_clipboard')"
        @click="emit('copy-link')"
      >
        {{ lobby.code }}
      </UButton>

      <!-- Mobile icon fallback -->
      <span class="flex sm:hidden">
        <UButton
          aria-label="Copy Lobby Code"
          color="info"
          icon="i-solar-copy-bold-duotone"
          variant="subtle"
        />
      </span>

      <!-- Leave button inline (desktop) -->
      <UButton
        class="cursor-pointer text-white"
        color="error"
        size="xl"
        variant="subtle"
        trailing-icon="i-solar-exit-bold-duotone"
        @click="emit('leave')"
      >
        <span class="hidden xl:inline">{{ t("game.leave_game") }}</span>
      </UButton>
    </UFieldGroup>

    <!-- Mobile copy button -->
    <UButton
      v-if="mobile"
      class="text-slate-100 text-xl ml-2"
      :color="copied ? 'success' : 'secondary'"
      :icon="
        copied
          ? 'i-solar-clipboard-check-bold-duotone'
          : 'i-solar-copy-bold-duotone'
      "
      variant="subtle"
      :aria-label="t('lobby.copy_to_clipboard')"
      @click="emit('copy-link')"
    >
      {{ lobby.code }}
    </UButton>
  </div>

  <!-- Mobile leave button (full-width, separate) -->
  <UButton
    v-if="mobile"
    class="cursor-pointer text-white"
    color="error"
    size="xl"
    block
    variant="soft"
    trailing-icon="i-solar-exit-bold-duotone"
    @click="emit('leave')"
  >
    {{ t("game.leave_game") }}
  </UButton>

  <!-- Player list -->
  <PlayerList
    :allow-moderation="true"
    :host-user-id="lobby?.hostUserId || ''"
    :lobby-id="lobby?.$id || ''"
    :players="players"
    :judge-id="state?.judgeId ?? undefined"
    :submissions="state?.submissions"
    :game-phase="state?.phase"
    :scores="state?.scores"
    :skipped-players="state?.skippedPlayers || []"
    @convert-spectator="emit('convert-spectator', $event)"
    @skip-player="emit('skip-player', $event)"
  />

  <!-- Bot Controls (host only, waiting phase) -->
  <div
    v-if="isWaiting && (canAddBot || botPlayers.length > 0)"
    class="font-['Bebas_Neue'] text-2xl rounded-xl p-4 shadow-lg w-full mx-auto flex flex-col gap-2 items-center border-2 border-slate-500 bg-slate-600"
  >
    <UButton
      v-if="canAddBot"
      icon="i-mdi-robot"
      size="lg"
      color="info"
      class="w-full font-['Bebas_Neue'] text-xl"
      :loading="addingBot"
      :disabled="addingBot"
      @click="addBot"
    >
      {{ t("lobby.add_bot") }} ({{ botPlayers.length }}/5)
    </UButton>
    <p v-if="botError" class="text-red-400 text-sm">{{ botError }}</p>
  </div>

  <!-- Chat -->
  <ChatBox
    v-if="joinedLobby"
    :current-user-id="myId"
    :lobby-id="lobby?.$id || ''"
  />

  <!-- Waiting room controls -->
  <div v-if="isWaiting">
    <div
      class="font-['Bebas_Neue'] text-2xl rounded-xl p-4 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600"
    >
      <div v-if="players.length >= 3" :class="mobile ? 'w-full' : ''">
        <UButton
          v-if="isHost && !isStarting"
          icon="i-solar-play-bold"
          size="lg"
          color="success"
          class="w-full text-black font-['Bebas_Neue'] text-xl"
          @click="emit('start-game')"
        >
          {{ t("lobby.start_game") }}
        </UButton>
        <UButton v-if="isHost && isStarting" :loading="true" disabled>
          {{ t("lobby.starting_game") }}
        </UButton>
        <p
          v-if="!isHost && !isStarting"
          class="text-gray-400 text-center font-['Bebas_Neue'] text-2xl"
        >
          {{ t("lobby.waiting_for_host_start_game") }}
        </p>
        <p
          v-if="!isHost && isStarting"
          class="text-green-400 text-center font-['Bebas_Neue'] text-2xl"
        >
          {{ t("lobby.starting_game") }}
        </p>
      </div>
      <div v-else>
        <p class="text-amber-400 text-center font-['Bebas_Neue'] text-xl">
          {{ t("lobby.players_needed") }}
        </p>
      </div>
    </div>

    <GameSettings
      v-if="gameSettings"
      :host-user-id="lobby?.hostUserId || ''"
      :is-editable="isHost"
      :lobby-id="lobby?.$id || ''"
      :settings="gameSettings"
      class="mt-4"
      @update:settings="emit('update:settings', $event)"
    />
  </div>

  <!-- Switchers -->
  <div
    class="w-full flex flex-row gap-2 mt-4 items-center justify-center"
    :class="mobile ? 'mb-4' : ''"
  >
    <LanguageSwitcher />
    <VoiceSwitcher />
    <ThemeSwitcher v-if="!mobile" />
  </div>
</template>

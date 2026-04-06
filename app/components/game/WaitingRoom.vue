<template>
  <div
    v-if="lobby"
    class="w-full bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen flex flex-col"
  >
    <div
      class="fixed w-full inset-0 bg-[url('/img/textures/noise.png')] opacity-7 pointer-events-none"
    ></div>
    <!-- Sidebar - only render if not moved to [code].vue -->
    <aside
      v-if="!sidebarMoved"
      class="max-w-1/4 w-auto h-screen p-4 flex flex-col shadow-inner border-r border-slate-800 space-y-4"
    >
      <div
        class="text-2xl rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600"
      >
        <!-- Desktop: Lobby Code or Invite Friends -->
        <span class="items-center hidden sm:flex">
          <template v-if="isInDiscordActivity">
            <UButton
              class="text-slate-100 text-xl ml-2"
              color="primary"
              icon="i-solar-users-group-rounded-bold-duotone"
              variant="subtle"
              @click="handleInviteFriends"
            >
              Invite Friends
            </UButton>
          </template>
          <template v-else>
            {{ t("lobby.lobby_code") }}:
            <UButton
              class="text-slate-100 text-2xl ml-2"
              color="info"
              icon="i-solar-copy-bold-duotone"
              variant="subtle"
            >
              {{ lobby.code }}
            </UButton>
          </template>
        </span>

        <!-- Mobile: Invite or Copy icon -->
        <span class="flex sm:hidden">
          <UButton
            v-if="isInDiscordActivity"
            aria-label="Invite Friends"
            color="primary"
            icon="i-solar-users-group-rounded-bold-duotone"
            variant="subtle"
            @click="handleInviteFriends"
          />
          <UButton
            v-else
            aria-label="{{ t('lobby.copy_lobby_code') }}"
            color="info"
            icon="i-solar-copy-bold-duotone"
            variant="subtle"
          />
        </span>

        <!-- Leave Button (shows on all sizes) -->
        <UButton
          class="cursor-pointer text-white"
          color="error"
          size="xl"
          trailing-icon="i-solar-exit-bold-duotone"
          @click="handleLeave"
        >
          <span class="hidden xl:inline">{{ t("game.leave_game") }}</span>
        </UButton>
      </div>
      <PlayerList
        :allow-moderation="true"
        :hostUserId="lobby.hostUserId"
        :lobbyId="lobby.$id"
        :players="players"
      />

      <!-- Bot Controls (host only) -->
      <div
        v-if="canAddBot || botPlayers.length > 0"
        class="flex flex-col gap-2"
      >
        <UButton
          v-if="canAddBot"
          icon="i-mdi-robot"
          color="neutral"
          variant="subtle"
          :loading="addingBot"
          :disabled="addingBot"
          @click="addBot"
        >
          {{ t("lobby.add_bot") }} ({{ botPlayers.length }}/5)
        </UButton>
        <p v-if="botError" class="text-red-400 text-xs">{{ botError }}</p>
      </div>

      <LazyChatBox />
      <div v-if="players.length >= 3">
        <UButton
          v-if="isHost && !isStarting"
          icon="i-solar-play-bold"
          color="warning"
          @click="startGameWrapper"
        >
          {{ t("lobby.start_game") }}
        </UButton>
        <UButton v-if="isHost && isStarting" :loading="true" disabled>
          {{ t("lobby.starting_game") }}
        </UButton>
        <p
          v-if="!isHost && !isStarting"
          class="text-gray-400 text-center font-display text-4xl"
        >
          {{ t("lobby.waiting_for_host_start_game") }}
        </p>
        <p
          v-if="!isHost && isStarting"
          class="text-green-400 text-center font-display text-4xl"
        >
          {{ t("lobby.starting_game") }}
        </p>
      </div>
      <div v-else>
        <p class="text-amber-400 text-center font-display text-2xl">
          {{ t("lobby.players_needed") }}
        </p>
      </div>
    </aside>

    <!-- Main content area - full width if sidebar is moved -->
    <div :class="{ 'flex-1': !sidebarMoved, 'w-full': sidebarMoved }">
      <WaitingHero
        v-if="sidebarMoved"
        :lobby-code="lobby.code"
        :players="players"
        :is-host="isHost"
        :is-starting="isStarting"
        @start-game="startGameWrapper"
      />
      <GameSettings
        v-if="lobbyReactive.settings.value && !sidebarMoved"
        :is-editable="isHost"
        :settings="lobbyReactive.settings.value"
      />
    </div>
  </div>
  <div v-else>
    <p class="text-red-400 text-sm">{{ t("lobby.error_loading_gamestate") }}</p>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
const { isDiscordActivity, inviteFriends } = useDiscordSDK();
const isInDiscordActivity = isDiscordActivity.value;

async function handleInviteFriends() {
  try {
    await inviteFriends();
  } catch (err) {
    console.error("Failed to open invite dialog:", err);
  }
}

const { t } = useI18n();

const props = defineProps<{
  lobby: Lobby;
  players: Player[];
  sidebarMoved?: boolean;
}>();
const lobbyRef = ref(props.lobby);
// Keep lobbyRef in sync with props.lobby
watch(
  () => props.lobby,
  (newLobby) => {
    lobbyRef.value = newLobby;
  },
  { immediate: true },
);

const router = useRouter();
const userStore = useUserStore();
const { startGame, leaveLobby, reactive: lobbyReactive } = useLobby();
const myId = userStore.user?.$id ?? "";
const isHost = computed(() => props.lobby?.hostUserId === userStore.user?.$id);

// Bot management
const playersRef = computed(() => props.players);
const { botPlayers, canAddBot, addingBot, botError, addBot } = useBots(
  lobbyRef,
  playersRef,
  isHost,
);

const isStarting = ref(false);

const startGameWrapper = async () => {
  if (!props.lobby) return;
  try {
    isStarting.value = true;
    const s = lobbyReactive.settings.value;
    await startGame(props.lobby.$id, s ? {
      maxPoints: s.maxPoints,
      numPlayerCards: s.cardsPerPlayer,
      cardPacks: s.cardPacks,
      isPrivate: s.isPrivate,
      lobbyName: s.lobbyName,
    } : null);
  } catch (err) {
    // console.error('Failed to start game:', err);
    isStarting.value = false;
  }
};

const handleLeave = async () => {
  if (!props.lobby || !userStore.user?.$id) return;
  try {
    await leaveLobby(props.lobby.$id, userStore.user.$id);
    await router.push("/");
  } catch (err) {
    // console.error('Failed to leave lobby:', err);
  }
};
</script>

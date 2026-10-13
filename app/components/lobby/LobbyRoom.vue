<template>
  <div class="lobby-room">
    <div class="lobby-room-bg">
      <ScrollingBackground
        :gap="12"
        :scale="0.5"
        :speed-px="15"
        :disable-on-mobile="false"
      />
    </div>

    <LobbyCompact
      v-if="isCompact"
      :code="lobby.code"
      :lobby-name="reactive.settings.value?.lobbyName ?? ''"
      :players="players"
      :my-id="myId ?? ''"
      :is-host="isHost"
      :is-starting="isStarting"
      :max-seats="maxSeats"
      :settings="reactive.settings.value ?? null"
      :pack-names="packNames"
      :shuffling="shufflePending"
      :chat-messages="reactive.chat.value"
      @toggle-ready="handleToggleReady"
      @start="startGameWrapper"
      @add-bot="addBot"
      @kick="handleKick"
      @leave="$emit('leave')"
      @edit-settings="openEditor()"
      @open-app-settings="uiStore.showSettings = true"
      @shuffle="shufflePacks"
    />

    <template v-else>
      <main class="lobby-room-main">
        <div class="lobby-room-grid">
          <LobbyChat class="lobby-room-chat" :messages="reactive.chat.value" />
          <LobbyPlayerGrid
            class="lobby-room-players"
            :code="lobby.code"
            :lobby-name="reactive.settings.value?.lobbyName ?? ''"
            :players="players"
            :my-id="myId ?? ''"
            :is-host-user="isHost"
            :max-seats="maxSeats"
            @add-bot="addBot"
            @kick="handleKick"
          />
          <LobbyHouseRules
            class="lobby-room-rules"
            :settings="reactive.settings.value"
            :is-host="isHost"
            :shuffling="shufflePending"
            @edit="openEditor"
            @shuffle="shufflePacks"
          />
        </div>
      </main>

      <LobbyStartBar
        :players="players"
        :my-id="myId ?? ''"
        :is-host="isHost"
        :is-starting="isStarting"
        @toggle-ready="handleToggleReady"
        @start="startGameWrapper"
        @leave="$emit('leave')"
        @open-app-settings="uiStore.showSettings = true"
      />
    </template>

    <LobbyRulesEditor
      :open="settingsOpen"
      :settings="reactive.settings.value"
      :is-host="isHost"
      :lobby-id="lobby.id"
      :pack-filter="editorFilter"
      @close="settingsOpen = false"
    />

    <SettingsSlideover v-model:open="uiStore.showSettings" />
  </div>
</template>

<script lang="ts" setup>
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import { useUiStore } from "~/stores/uiStore";
import { useCompactLayout } from "~/composables/useCompactLayout";
import { useRemovePlayer } from "~/composables/useRemovePlayer";
import type { PackFilter } from "~/utils/lobbyPackSelection";

const props = defineProps<{
  lobby: Lobby;
  players: Player[];
}>();

defineEmits<{ (e: "leave"): void }>();

const userStore = useUserStore();
const uiStore = useUiStore();
const { isCompact } = useCompactLayout();
const { startGame, reactive, mutations } = useLobby();
const { notify } = useNotifications();
const { t } = useI18n();

const isHost = computed(
  () => reactive.isHost.value || props.lobby.hostUserId === userStore.user?.id,
);

const { addBot } = useBots(
  computed(() => props.lobby),
  computed(() => props.players),
  isHost,
);

const settingsOpen = ref(false);
const editorFilter = ref<PackFilter>("all");
function openEditor(filter: PackFilter = "all") {
  editorFilter.value = filter;
  settingsOpen.value = true;
}
const isStarting = ref(false);

// Same action the settings drawer exposes, surfaced here so the host can
// re-roll the packs without opening settings.
const { shuffle, pending: shufflePending } = useShufflePacks();
function shufflePacks() {
  if (!isHost.value) return;
  return shuffle(reactive.settings.value?.cardPacks ?? []);
}

// The summary renders pack names; the doc holds ids. Shares the load-once
// roster useShufflePacks already uses.
const { tiles: packTiles, load: loadPackRoster } = useCardPacks();
const packNames = computed(() =>
  Object.fromEntries(packTiles.value.map((tile) => [tile.id, tile.pack])),
);
onMounted(() => loadPackRoster());

const myId = computed(() => userStore.user?.id ?? null);

// Start with 2 open seats when 1 player is in the lobby (3 total to show minimum required).
// When player 2 joins, they take the 2nd seat (leaving 1 open seat).
// For 3+ players, each new player adds a seat while keeping 1 open seat, capped at 16 for table layout sanity.
// The lobby itself has no hard player limit.
const maxSeats = computed(() =>
  Math.min(Math.max(props.players.length + 1, 3), 16),
);

async function startGameWrapper() {
  isStarting.value = true;
  try {
    const s = reactive.settings.value;
    await startGame(props.lobby.id, s ? {
      maxPoints: s.maxPoints,
      numPlayerCards: s.cardsPerPlayer,
      cardPacks: s.cardPacks,
      isPrivate: s.isPrivate,
      lobbyName: s.lobbyName,
    } : null);
  } catch (err) {
    console.error("Failed to start game:", err);
    notify({ title: t("lobby.start_failed"), color: "error", icon: "i-mdi-alert-circle" });
  } finally {
    isStarting.value = false;
  }
}

function handleToggleReady() {
  if (!myId.value) return;
  const me = props.players.find((p) => p.userId === myId.value);
  mutations.setPlayerReady(myId.value, !(me?.ready ?? false));
}

// Anyone but the host. A person goes through the server kick, so their row
// goes too and their client is sent home; removing them from the doc alone
// let them straight back in on refresh.
const { removePlayer } = useRemovePlayer();
function handleKick(playerId: string) {
  if (!isHost.value) return;
  const target = props.players.find((p) => p.$id === playerId);
  if (!target || target.isHost) return;
  removePlayer(props.lobby.id, target);
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}

function handleEsc(e: KeyboardEvent) {
  if (isCompact.value) return;
  if (e.key !== "Escape" || isTypingTarget(e.target)) return;
  if (settingsOpen.value || uiStore.showSettings) return;
  uiStore.showSettings = true;
}

onMounted(() => {
  window.addEventListener("keydown", handleEsc);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleEsc);
});
</script>

<style scoped>
.lobby-room {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  max-height: 100dvh;
  overscroll-behavior: none;
  position: relative;
  overflow: hidden;
}

.lobby-room-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.8;
}
.lobby-room > :not(.lobby-room-bg) {
  position: relative;
  z-index: 1;
}

.lobby-room-main {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 16px 20px 12px;
  overflow: hidden;
}

.lobby-room-grid {
  width: 100%;
  height: 100%;
  max-width: 1920px;
  margin: 0 auto;
  min-height: 0;
  display: grid;
  gap: 14px;
  /* 768–1023px: players + rules side by side, chat under the players. */
  grid-template-columns: minmax(0, 1fr) 260px;
  grid-template-rows: minmax(0, 1fr) 220px;
  grid-template-areas:
    "players rules"
    "chat    rules";
}
.lobby-room-players { grid-area: players; min-height: 0; }
.lobby-room-rules { grid-area: rules; min-height: 0; }
.lobby-room-chat { grid-area: chat; min-height: 0; height: 100%; }

@media (min-width: 1024px) {
  .lobby-room-grid {
    grid-template-columns: 280px minmax(0, 1fr) 310px;
    grid-template-rows: minmax(0, 1fr);
    grid-template-areas: "chat players rules";
  }
}
</style>

<style>
@import "~/assets/css/lobby.css";

/* panel-striped variant; unscoped so LobbyPlayerGrid picks it up */
.lobby-panel-striped {
  background:
    repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.02) 0 10px, rgba(255, 255, 255, 0) 10px 20px),
    rgba(10, 13, 28, 0.72);
}
</style>

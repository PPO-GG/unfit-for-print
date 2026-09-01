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

    <main class="lobby-room-main">
      <div class="lobby-room-grid">
        <LobbyChat class="lobby-room-chat" :messages="reactive.chat.value" />

        <div class="lobby-room-table-wrap lobby-panel lobby-panel-striped">
          <LobbyTable
            :players="players"
            :max-seats="maxSeats"
            :is-host-user="isHost"
            @add-bot="addBot"
          />
        </div>
        <LobbyRoundPreview
          class="lobby-room-preview"
          :cards-per-player="reactive.settings.value?.cardsPerPlayer ?? 0"
          :max-pick="reactive.settings.value?.maxPick ?? 0"
          :active-packs-count="(reactive.settings.value?.cardPacks ?? []).length"
        />

        <aside class="lobby-room-sidebar">
          <LobbyCodePanel :code="lobby.code" />
          <LobbyPlayerList
            :players="players"
            :max-seats="maxSeats"
            :is-host-user="isHost"
            @add-bot="addBot"
            @kick="handleKick"
          />
          <LobbySettingsSummary
            :settings="reactive.settings.value"
            @edit="settingsOpen = true"
          />
        </aside>
      </div>
    </main>

    <LobbyStartBar
      :lobby-name="reactive.settings.value?.lobbyName ?? ''"
      :players="players"
      :my-id="myId ?? ''"
      :is-host="isHost"
      :is-starting="isStarting"
      :max-seats="maxSeats"
      @toggle-ready="handleToggleReady"
      @start="startGameWrapper"
      @add-bot="addBot"
      @leave="$emit('leave')"
      @open-settings="settingsOpen = !settingsOpen"
      @open-app-settings="uiStore.showSettings = true"
    />

    <LobbySettingsDrawer
      :open="settingsOpen"
      :settings="reactive.settings.value"
      :is-host="isHost"
      @close="settingsOpen = false"
    />

    <SettingsSlideover v-model:open="uiStore.showSettings" />
  </div>
</template>

<script lang="ts" setup>
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import { useUiStore } from "~/stores/uiStore";

const props = defineProps<{
  lobby: Lobby;
  players: Player[];
}>();

defineEmits<{ (e: "leave"): void }>();

const userStore = useUserStore();
const uiStore = useUiStore();
const { startGame, reactive, mutations } = useLobby();

const isHost = computed(
  () => reactive.isHost.value || props.lobby.hostUserId === userStore.user?.id,
);

const { addBot } = useBots(
  computed(() => props.lobby),
  computed(() => props.players),
  isHost,
);

const settingsOpen = ref(false);
const isStarting = ref(false);

const myId = computed(() => userStore.user?.id ?? null);

// Show all current players + 2 open seats, minimum 8, capped at 16 for visual sanity.
// The lobby itself has no hard player limit.
const maxSeats = computed(() =>
  Math.min(Math.max(props.players.length + 2, 8), 16),
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
  } finally {
    isStarting.value = false;
  }
}

function handleToggleReady() {
  if (!myId.value) return;
  const me = props.players.find((p) => p.userId === myId.value);
  mutations.setPlayerReady(myId.value, !(me?.ready ?? false));
}

function handleKick(playerId: string) {
  if (!isHost.value) return;
  const target = props.players.find((p) => p.$id === playerId);
  mutations.removePlayer(playerId, target?.name);
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}

function handleEsc(e: KeyboardEvent) {
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
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
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
  display: flex;
  align-items: center;
  padding: 16px 20px 20px;
  overflow-y: auto;
  min-height: 0;
}

.lobby-room-grid {
  width: 100%;
  max-width: 1760px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

@media (min-width: 1024px) {
  .lobby-room-grid {
    grid-template-columns: minmax(220px, 0.85fr) minmax(0, 2.4fr);
    grid-template-rows: auto auto auto;
    align-items: stretch;
  }

  .lobby-room-chat {
    grid-column: 1;
    grid-row: 1 / span 2;
    min-height: 0;
  }

  .lobby-room-table-wrap {
    grid-column: 2;
    grid-row: 1;
  }

  .lobby-room-preview {
    grid-column: 2;
    grid-row: 2;
  }

  .lobby-room-sidebar {
    grid-column: 1 / -1;
    grid-row: 3;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
  }
}

@media (min-width: 1280px) {
  .lobby-room-grid {
    grid-template-columns: minmax(280px, 1fr) minmax(540px, 2.4fr) minmax(280px, 1fr);
    grid-template-rows: auto auto;
  }

  .lobby-room-sidebar {
    grid-column: 3;
    grid-row: 1 / span 2;
    display: flex;
  }
}

.lobby-room-table-wrap {
  padding: 20px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.lobby-room-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.lobby-room-sidebar > * {
  width: 100%;
  min-width: 0;
}

/* panel-striped variant */
.lobby-panel-striped {
  background:
    repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.02) 0 10px, rgba(255, 255, 255, 0) 10px 20px),
    rgba(10, 13, 28, 0.72);
}
</style>

<style>
@import "~/assets/css/lobby.css";
</style>

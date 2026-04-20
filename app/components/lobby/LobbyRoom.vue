<template>
  <div class="lobby-room">
    <div class="lobby-room-bg">
      <ScrollingBackground :speed-px="40" :disable-on-mobile="false" />
    </div>

    <LobbyTopBar
      :lobby-name="reactive.settings.value?.lobbyName ?? ''"
      :max-points="reactive.settings.value?.maxPoints ?? 0"
      :max-pick="reactive.settings.value?.maxPick ?? 0"
      :pack-count="(reactive.settings.value?.cardPacks ?? []).length"
      @leave="$emit('leave')"
      @open-settings="settingsOpen = !settingsOpen"
    />

    <main class="lobby-room-main">
      <div class="lobby-room-grid">
        <!-- LEFT: Table + Round Preview -->
        <section class="lobby-room-left">
          <div class="lobby-room-table-wrap lobby-panel lobby-panel-striped">
            <LobbyTable
              :players="players"
              :max-seats="maxSeats"
              :is-host-user="isHost"
              @add-bot="addBot"
            />
          </div>
          <LobbyRoundPreview
            :cards-per-player="reactive.settings.value?.cardsPerPlayer ?? 0"
            :max-pick="reactive.settings.value?.maxPick ?? 0"
            :active-packs-count="(reactive.settings.value?.cardPacks ?? []).length"
          />
        </section>

        <!-- RIGHT: Sidebar stack -->
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
      ref="startBarEl"
      :players="players"
      :my-id="myId ?? ''"
      :is-host="isHost"
      :is-starting="isStarting"
      :max-seats="maxSeats"
      @toggle-ready="handleToggleReady"
      @start="startGameWrapper"
      @add-bot="addBot"
    />

    <LobbyChat :messages="reactive.chat.value" />

    <LobbySettingsDrawer
      :open="settingsOpen"
      :settings="reactive.settings.value"
      :is-host="isHost"
      @close="settingsOpen = false"
    />
  </div>
</template>

<script lang="ts" setup>
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";

const props = defineProps<{
  lobby: Lobby;
  players: Player[];
}>();

defineEmits<{ (e: "leave"): void }>();

const userStore = useUserStore();
const { startGame, reactive, mutations } = useLobby();
const { addBot } = useBots(
  computed(() => props.lobby),
  computed(() => props.players),
  computed(() => props.lobby.hostUserId === userStore.user?.$id),
);

const settingsOpen = ref(false);
const isStarting = ref(false);

const isHost = computed(
  () => props.lobby.hostUserId === userStore.user?.$id,
);

const myId = computed(() => userStore.user?.$id ?? null);

// Show all current players + 2 open seats, minimum 8, capped at 16 for visual sanity.
// The lobby itself has no hard player limit.
const maxSeats = computed(() =>
  Math.min(Math.max(props.players.length + 2, 8), 16),
);

async function startGameWrapper() {
  isStarting.value = true;
  try {
    const s = reactive.settings.value;
    await startGame(props.lobby.$id, s ? {
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

// Measure the start bar and expose its height as a CSS var so the floating
// chat can anchor just above it regardless of how tall the bar becomes.
const startBarEl = ref<{ $el?: HTMLElement } | HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

function applyStartBarHeight(h: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--lb-startbar-height", `${Math.round(h)}px`);
}

onMounted(() => {
  const el = startBarEl.value && "$el" in startBarEl.value ? startBarEl.value.$el : startBarEl.value as HTMLElement | null;
  if (!el || typeof ResizeObserver === "undefined") return;
  applyStartBarHeight(el.getBoundingClientRect().height);
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) applyStartBarHeight(entry.contentRect.height);
  });
  resizeObserver.observe(el);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (typeof document !== "undefined") {
    document.documentElement.style.removeProperty("--lb-startbar-height");
  }
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
}
.lobby-room > :not(.lobby-room-bg) {
  position: relative;
  z-index: 1;
}

.lobby-room-main {
  flex: 1;
  padding: 16px 20px 20px;
  overflow-y: auto;
  min-height: 0;
}

.lobby-room-grid {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

@media (min-width: 1024px) {
  .lobby-room-grid {
    grid-template-columns: minmax(0, 8fr) minmax(280px, 3fr);
    align-items: start;
  }
}

@media (min-width: 1440px) {
  .lobby-room-grid {
    grid-template-columns: minmax(0, 9fr) minmax(320px, 3fr);
  }
}

.lobby-room-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
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

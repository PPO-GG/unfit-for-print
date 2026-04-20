<template>
  <div class="lobby-room">
    <LobbyTopBar
      :lobby-name="reactive.settings.value?.lobbyName ?? ''"
      :max-points="reactive.settings.value?.maxPoints ?? 0"
      :max-pick="reactive.settings.value?.maxPick ?? 0"
      :pack-count="(reactive.settings.value?.cardPacks ?? []).length"
      @leave="$emit('leave')"
      @open-settings="settingsOpen = !settingsOpen"
    />

    <LobbyTable
      :players="players"
      :max-seats="maxSeats"
      :is-host-user="isHost"
      class="lobby-room-table"
      @add-bot="addBot"
    />

    <LobbyStartBar
      :players="players"
      :my-id="myId ?? ''"
      :is-host="isHost"
      :is-starting="isStarting"
      @toggle-ready="handleToggleReady"
      @start="startGameWrapper"
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
</script>

<style scoped>
.lobby-room {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.lobby-room-table {
  flex: 1;
  min-height: 0;
}
</style>

<style>
@import "~/assets/css/lobby.css";
</style>

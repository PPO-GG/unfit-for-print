<template>
  <div
    v-if="lobby"
    class="w-full bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen flex flex-col"
  >
    <div
      class="absolute w-full inset-0 bg-[url('/img/textures/noise.png')] opacity-7 pointer-events-none"
    ></div>
    <!-- Sidebar - only render if not moved to [code].vue -->
    <aside
      v-if="!sidebarMoved"
      class="max-w-1/4 w-auto h-screen p-4 flex flex-col shadow-inner border-r border-slate-800 space-y-4"
    >
      <div
        class="font-['Bebas_Neue'] text-2xl rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto flex justify-between items-center border-2 border-slate-500 bg-slate-600"
      >
        <!-- Desktop: Lobby Code label + button -->
        <span class="items-center hidden sm:flex">
          {{ t("lobby.lobby_code") }}:
          <UButton
            class="text-slate-100 text-2xl ml-2"
            color="info"
            icon="i-solar-copy-bold-duotone"
            variant="subtle"
          >
            {{ lobby.code }}
          </UButton>
        </span>

        <!-- Mobile: Just the icon -->
        <span class="flex sm:hidden">
          <UButton
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
      <LazyChatBox :current-user-id="myId" :lobbyId="props.lobby.$id" />
      <div v-if="players.length >= 3">
        <UButton
          v-if="isHost && !isStarting"
          icon="i-solar-play-bold"
          @click="startGameWrapper"
        >
          {{ t("lobby.start_game") }}
        </UButton>
        <UButton v-if="isHost && isStarting" :loading="true" disabled>
          {{ t("lobby.starting_game") }}
        </UButton>
        <p
          v-if="!isHost && !isStarting"
          class="text-gray-400 text-center font-['Bebas_Neue'] text-4xl"
        >
          {{ t("lobby.waiting_for_host_start_game") }}
        </p>
        <p
          v-if="!isHost && isStarting"
          class="text-green-400 text-center font-['Bebas_Neue'] text-4xl"
        >
          {{ t("lobby.starting_game") }}
        </p>
      </div>
      <div v-else>
        <p class="text-gray-400 text-center font-['Bebas_Neue'] text-2xl">
          {{ t("lobby.players_needed") }}
        </p>
      </div>
    </aside>

    <!-- Main content area - full width if sidebar is moved -->
    <div :class="{ 'flex-1': !sidebarMoved, 'w-full': sidebarMoved }">
      <GameSettings
        v-if="gameSettings && !sidebarMoved"
        :host-user-id="lobby.hostUserId"
        :is-editable="isHost"
        :lobby-id="lobby.$id"
        :settings="gameSettings"
        @update:settings="handleSettingsUpdate"
      />
    </div>
  </div>
  <div v-else>
    <p class="text-red-400 text-sm">{{ t("lobby.error_loading_gamestate") }}</p>
  </div>
</template>

<script lang="ts" setup>
import { computed, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import { getAppwrite } from "~/utils/appwrite";
import type { Client } from "appwrite";
import type { Lobby } from "~/types/lobby";
import type { Player } from "~/types/player";
import type { GameSettings } from "~/types/gamesettings";
import { useNotifications } from "~/composables/useNotifications";
import { resolveId } from "~/utils/resolveId";

const { t } = useI18n();
const { notify } = useNotifications();

const { client } = getAppwrite();
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
const { startGame, leaveLobby } = useLobby();
const { getGameSettings, createDefaultGameSettings } = useGameSettings();
const myId = userStore.user?.$id ?? "";
const isHost = computed(() => props.lobby?.hostUserId === userStore.user?.$id);

const isStarting = ref(false);
const gameSettings = ref<GameSettings | null>(null);

// Set up real-time listener for game settings changes
const setupGameSettingsRealtime = () => {
  if (!props.lobby) return;

  if (!client) return;
  const config = useRuntimeConfig();

  // Subscribe to changes in the game settings collection for this lobby
  const unsubscribeGameSettings = client.subscribe(
    [
      `databases.${config.public.appwriteDatabaseId}.collections.${config.public.appwriteGameSettingsCollectionId}.documents`,
    ],
    async ({ payload }: { payload: unknown }) => {
      // Check if this is a game settings document for our lobby
      const settings = payload as GameSettings;
      // Handle case where lobbyId is a relationship object
      const settingsLobbyId = resolveId(settings.lobbyId);

      if (settingsLobbyId === props.lobby.$id) {
        // console.log('[Realtime] Game settings updated:', settings);
        gameSettings.value = settings;

        // If you're not the host and settings changed, show a notification
        if (!isHost.value) {
          notify({
            title: t("game.settings.updated"),
            icon: "i-solar-info-circle-bold-duotone",
            color: "primary",
            duration: 3000,
          });
        }
      }
    },
  );

  // Clean up subscription when component is unmounted
  onUnmounted(() => {
    unsubscribeGameSettings?.();
  });
};

// Fetch game settings when the component is mounted
onMounted(async () => {
  if (props.lobby) {
    try {
      // Try to get existing settings
      const settings = await getGameSettings(props.lobby.$id);

      // If no settings exist and user is host, create default settings
      if (!settings && isHost.value) {
        gameSettings.value = await createDefaultGameSettings(
          props.lobby.$id,
          `${userStore.user?.name || "Anonymous"}'s Game`,
          userStore.user?.$id, // Pass the host user ID
        );
      } else {
        gameSettings.value = settings;
      }

      // Set up real-time listener for game settings changes
      setupGameSettingsRealtime();
    } catch (err) {
      // console.error('Failed to load game settings:', err);
    }
  }
});
const handleSettingsUpdate = (newSettings: GameSettings) => {
  gameSettings.value = newSettings;
};

const startGameWrapper = async () => {
  if (!props.lobby) return;
  try {
    isStarting.value = true;
    // Pass game settings to the startGame function
    await startGame(props.lobby.$id, gameSettings.value);
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

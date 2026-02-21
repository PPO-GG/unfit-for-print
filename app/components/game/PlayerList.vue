<script setup lang="ts">
import { computed, ref } from "vue";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import type { Player } from "~/types/player";
import { useGameContext } from "~/composables/useGameContext";
import type { Lobby } from "~/types/lobby";

const { t } = useI18n();
const props = defineProps<{
  players: Player[];
  hostUserId: string;
  lobbyId: string;
  judgeId?: string;
  submissions?: Record<string, any>;
  gamePhase?: string;
  scores?: Record<string, number>;
  avatarUrl?: string;
  skippedPlayers?: string[];
}>();

const emit = defineEmits<{
  (e: "convert-spectator", playerId: string): void;
  (e: "skip-player", playerId: string): void;
}>();

// Create a ref for the lobby and initialize it with basic data
function createLobby(partial: Partial<Lobby>): Lobby {
  return {
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    code: "",
    status: "waiting",
    round: 0,
    ...partial,
  } as Lobby;
}

// Then use it like this:
const lobbyRef = ref<Lobby>(
  createLobby({
    $id: props.lobbyId,
    hostUserId: props.hostUserId,
    players: props.players.map((player) => player.$id),
    gameState: JSON.stringify({
      phase: "waiting",
      scores: {},
    }),
  }),
);

const { scores } = useGameContext(lobbyRef);
const { kickPlayer, promoteToHost, reshufflePlayerCards } = useLobby();
const userStore = useUserStore();
const { notify } = useNotifications();

const currentUserId = computed(() => userStore.user?.$id);
const isHost = computed(() => props.hostUserId === currentUserId.value);

const kick = async (player: Player) => {
  try {
    if (player.playerType === "bot") {
      // Bots are created server-side with admin permissions,
      // so we must delete them via our server endpoint too
      const userStore = useUserStore();
      await $fetch("/api/bot/remove", {
        method: "POST",
        body: {
          lobbyId: props.lobbyId,
          botUserId: player.userId,
          hostUserId: userStore.user?.$id,
        },
      });
    } else {
      await kickPlayer(player.$id);
    }
  } catch (err) {
    console.error("Failed to kick player:", err);
    notify({
      title: t("lobby.error_failed_to_kick", {
        name: player.name || "Unknown Player",
      }),
      color: "error",
    });
  }
};

const sortedPlayers = computed(() => {
  return props.players.slice().sort((a, b) => {
    if (a.userId === props.hostUserId) return -1;
    if (b.userId === props.hostUserId) return 1;
    return 0;
  });
});

const promote = async (player: Player) => {
  try {
    await promoteToHost(props.lobbyId, player);
  } catch (err) {
    // console.error("Failed to promote host:", err)
    notify({
      title: t("lobby.error_failed_to_promote", {
        name: player.name || "Unknown Player",
      }),
      color: "error",
    });
  }
};

const reshuffleCards = async () => {
  try {
    await reshufflePlayerCards(props.lobbyId);
    notify({
      title: "Cards Reshuffled",
      description: "All player cards have been reshuffled",
      color: "success",
    });
  } catch (err) {
    console.error("Failed to reshuffle cards:", err);
    notify({
      title: "Error",
      description: "Failed to reshuffle cards",
      color: "error",
    });
  }
};

const isPlayerSkipped = (userId: string) => {
  return props.skippedPlayers?.includes(userId) ?? false;
};

const canSkipPlayer = (player: Player) => {
  return (
    isHost.value &&
    props.gamePhase === "submitting" &&
    player.userId !== currentUserId.value &&
    player.userId !== props.judgeId &&
    player.playerType !== "spectator" &&
    !props.submissions?.[player.userId] &&
    !isPlayerSkipped(player.userId)
  );
};

const getScoreForPlayer = (playerId: string) => {
  // Use the scores prop if available, otherwise fall back to the scores from useGameContext
  if (props.scores && playerId in props.scores) {
    return props.scores[playerId];
  }
  return scores.value[playerId] || 0;
};

const getPlayerAvatarUrl = (player: Player) => {
  if (!player || !player.avatar) return null;

  // For providers that store direct URLs (like Google)
  if (player.provider === "google") {
    return player.avatar;
  }

  // For Discord users
  if (player.provider === "discord") {
    // Check if it's already a complete URL
    if (player.avatar.startsWith("https://cdn.discordapp.com/avatars/")) {
      return player.avatar;
    }

    // Otherwise, try to parse it as discordUserId/avatarHash
    const [discordUserId, avatarHash] = player.avatar.split("/");
    if (discordUserId && avatarHash) {
      return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.png`;
    }
  }

  // For any other provider or format, return the avatar as is if it looks like a URL
  if (player.avatar.startsWith("http")) {
    return player.avatar;
  }

  // Return null if no avatar is available or not in a usable format
  return null;
};
</script>

<template>
  <div
    class="font-display rounded-xl xl:p-4 lg:p-2 shadow-lg w-full mx-auto border border-slate-700/50 bg-slate-800/60"
  >
    <ul class="uppercase text-lg">
      <li
        v-for="player in sortedPlayers"
        :key="player.$id"
        class="flex items-center gap-2 p-2 rounded-lg transition-colors"
        :class="{
          'bg-amber-900/20 border border-amber-500/25':
            player.userId === judgeId,
          'bg-violet-900/20 border border-violet-500/25':
            player.userId === currentUserId && player.userId !== judgeId,
          'bg-slate-800/40 border border-transparent':
            player.userId !== judgeId && player.userId !== currentUserId,
        }"
      >
        <UAvatar
          v-if="getPlayerAvatarUrl(player)"
          :src="getPlayerAvatarUrl(player) ?? undefined"
          size="sm"
        />
        <UAvatar
          v-else-if="player.playerType === 'bot'"
          size="sm"
          icon="i-mdi-robot"
        />
        <UAvatar v-else size="sm" icon="i-solar-user-bold-duotone" />

        <!-- Host Crown -->
        <span
          v-if="player.userId === hostUserId"
          class="text-amber-400 shrink-0"
        >
          <Icon name="solar:crown-minimalistic-bold" class="align-middle" />
        </span>

        <!-- Player Name -->
        <span class="font-medium truncate">{{
          player.name || "Unknown Player"
        }}</span>
        <span
          v-if="player.userId === currentUserId"
          class="text-xs text-gray-400"
          >(YOU)</span
        >
        <!-- Player Status Indicators -->
        <div class="flex items-center gap-1.5">
          <span
            v-if="player.playerType === 'bot'"
            class="status-badge bg-cyan-500/20 text-cyan-300"
          >
            <Icon name="mdi:robot" class="mr-1" />BOT
          </span>
          <span
            v-else-if="player.playerType === 'spectator'"
            class="status-badge text-violet-300"
          >
            <Icon name="mdi:eye" class="mr-1" />{{ t("game.spectator") }}
          </span>
          <!-- Card Judge Indicator -->
          <span
            v-else-if="player.userId === judgeId"
            class="status-badge bg-yellow-500/20 text-yellow-300"
          >
            <Icon name="mdi:gavel" class="mr-1" />{{ t("game.judge") }}
          </span>

          <!-- Submitted Indicator -->
          <span
            v-else-if="submissions && submissions[player.userId]"
            class="status-badge bg-green-500/20 text-green-300"
          >
            <Icon name="mdi:check-circle" class="mr-1" />{{
              t("game.player_submitted")
            }}
          </span>

          <!-- Skipped Indicator -->
          <span
            v-else-if="isPlayerSkipped(player.userId)"
            class="status-badge bg-orange-500/20 text-orange-300"
          >
            <Icon name="mdi:skip-next" class="mr-1" />{{
              t("game.player_skipped")
            }}
          </span>

          <!-- Waiting Indicator -->
          <span
            v-else-if="gamePhase === 'submitting'"
            class="status-badge bg-blue-500/20 text-blue-300"
          >
            <Icon name="mdi:timer-sand" class="mr-1" />{{
              t("game.player_choosing")
            }}
          </span>
        </div>

        <!-- Player Score -->
        <span
          class="font-mono text-sm bg-slate-700/50 px-2 py-1 rounded text-green-400"
        >
          {{ getScoreForPlayer(player.userId) }}
        </span>

        <!-- Admin Actions -->
        <div class="flex gap-0.5 shrink-0">
          <UButton
            v-if="canSkipPlayer(player)"
            icon="i-mdi-skip-next"
            color="warning"
            variant="ghost"
            size="xs"
            square
            :title="t('game.skip_player')"
            @click="emit('skip-player', player.userId)"
          />
          <UButton
            v-if="
              isHost &&
              player.userId !== currentUserId &&
              player.playerType === 'spectator'
            "
            icon="i-mdi-account-plus"
            color="success"
            variant="ghost"
            size="xs"
            square
            @click="emit('convert-spectator', player.userId)"
          />
          <UButton
            v-if="
              isHost &&
              player.userId !== currentUserId &&
              player.provider !== 'anonymous'
            "
            icon="i-mdi-crown"
            color="warning"
            variant="ghost"
            size="xs"
            square
            @click="promote(player)"
          />
          <UButton
            v-if="isHost && player.userId !== currentUserId"
            icon="i-mdi-account-remove"
            color="error"
            variant="ghost"
            size="xs"
            square
            @click="kick(player)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>

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
  (e: "skip-judge"): void;
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

const canSkipJudge = (player: Player) => {
  return (
    isHost.value &&
    props.gamePhase === "judging" &&
    player.userId === props.judgeId
  );
};

const getScoreForPlayer = (playerId: string) => {
  if (props.scores && playerId in props.scores) {
    return props.scores[playerId];
  }
  return scores.value[playerId] || 0;
};

const getPlayerAvatarUrl = (player: Player): string | null => {
  if (!player?.avatar) return null;

  // Full URL already stored (Discord CDN, Google, etc.) — use directly
  if (player.avatar.startsWith("http")) {
    return player.avatar;
  }

  // Legacy fallback: bare hash stored for discord → reconstruct
  if (player.provider === "discord") {
    // Format could be "discordUserId/hash" or just a raw hash
    const parts = player.avatar.split("/");
    if (parts.length === 2) {
      const [discordUserId, avatarHash] = parts;
      return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.png`;
    }
  }

  return null;
};

/** Derive a player's current status for styling */
function getPlayerStatus(
  player: Player,
):
  | "judge"
  | "submitted"
  | "skipped"
  | "choosing"
  | "spectator"
  | "bot"
  | "idle" {
  if (player.playerType === "bot") return "bot";
  if (player.playerType === "spectator") return "spectator";
  if (player.userId === props.judgeId) return "judge";
  if (props.submissions?.[player.userId]) return "submitted";
  if (isPlayerSkipped(player.userId)) return "skipped";
  if (props.gamePhase === "submitting") return "choosing";
  return "idle";
}
</script>

<template>
  <div class="player-list-panel">
    <!-- Panel header -->
    <div class="panel-header">
      <Icon name="solar:users-group-rounded-bold-duotone" class="header-icon" />
      <span class="header-title">PLAYERS</span>
      <span class="header-count">{{ players.length }}</span>
    </div>

    <ul class="player-rows">
      <li
        v-for="player in sortedPlayers"
        :key="player.$id"
        class="player-row"
        :class="{
          'row--judge': player.userId === judgeId,
          'row--me':
            player.userId === currentUserId && player.userId !== judgeId,
          'row--submitted': getPlayerStatus(player) === 'submitted',
          'row--skipped': getPlayerStatus(player) === 'skipped',
          'row--spectator': getPlayerStatus(player) === 'spectator',
        }"
      >
        <!-- Avatar -->
        <div class="avatar-wrap">
          <UAvatar
            v-if="getPlayerAvatarUrl(player)"
            :src="getPlayerAvatarUrl(player) ?? undefined"
            size="sm"
            class="player-avatar"
          />
          <UAvatar
            v-else-if="player.playerType === 'bot'"
            size="sm"
            icon="i-mdi-robot"
            class="player-avatar avatar--bot"
          />
          <UAvatar
            v-else
            size="sm"
            icon="i-solar-user-bold-duotone"
            class="player-avatar"
          />

          <!-- Host crown overlay -->
          <span v-if="player.userId === hostUserId" class="crown-badge">
            <Icon name="solar:crown-minimalistic-bold" />
          </span>
        </div>

        <!-- Player info -->
        <div class="player-info">
          <div class="player-name-row">
            <span class="player-name">{{
              player.name || "Unknown Player"
            }}</span>
            <span v-if="player.userId === currentUserId" class="you-tag"
              >YOU</span
            >
          </div>

          <!-- Status badge -->
          <div class="status-row">
            <span
              v-if="getPlayerStatus(player) === 'judge'"
              class="status-badge badge--judge"
            >
              <Icon name="mdi:gavel" />{{ t("game.judge") }}
            </span>
            <span
              v-else-if="getPlayerStatus(player) === 'submitted'"
              class="status-badge badge--submitted"
            >
              <Icon name="mdi:check-circle" />{{ t("game.player_submitted") }}
            </span>
            <span
              v-else-if="getPlayerStatus(player) === 'skipped'"
              class="status-badge badge--skipped"
            >
              <Icon name="mdi:skip-next" />{{ t("game.player_skipped") }}
            </span>
            <span
              v-else-if="getPlayerStatus(player) === 'spectator'"
              class="status-badge badge--spectator"
            >
              <Icon name="mdi:eye" />{{ t("game.spectator") }}
            </span>
            <span
              v-else-if="getPlayerStatus(player) === 'bot'"
              class="status-badge badge--bot"
            >
              <Icon name="mdi:robot" />BOT
            </span>
            <span
              v-else-if="getPlayerStatus(player) === 'choosing'"
              class="status-badge badge--choosing"
            >
              <Icon name="mdi:timer-sand" />{{ t("game.player_choosing") }}
            </span>
          </div>
        </div>

        <div
          v-if="player.playerType !== 'spectator'"
          class="score-pill"
          :class="{
            'score-pill--has-score': getScoreForPlayer(player.userId ?? '') > 0,
          }"
        >
          <Icon name="solar:star-bold" class="score-icon" />
          <span class="score-num">{{
            getScoreForPlayer(player.userId ?? "")
          }}</span>
        </div>

        <!-- Host admin actions -->
        <div v-if="isHost" class="admin-actions">
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
            v-if="canSkipJudge(player)"
            icon="i-mdi-gavel"
            color="warning"
            variant="ghost"
            size="xs"
            square
            title="Skip Judge"
            @click="emit('skip-judge')"
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

<style scoped>
/* ─── Panel Shell ───────────────────────────────────────────── */
.player-list-panel {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 0.875rem;
  overflow: hidden;
}

/* ─── Header ────────────────────────────────────────────────── */
.panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid rgba(100, 116, 139, 0.15);
  background: rgba(139, 92, 246, 0.05);
}

.header-icon {
  font-size: 1rem;
  color: #8b5cf6;
}

.header-title {
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: #64748b;
  flex: 1;
}

.header-count {
  font-size: 0.85rem;
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 99px;
  padding: 0 0.5rem;
  line-height: 1.6;
}

/* ─── Player Rows ───────────────────────────────────────────── */
.player-rows {
  list-style: none;
  padding: 0.4rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: 0.6rem;
  border: 1px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

/* State variants */
.row--judge {
  background: rgba(245, 158, 11, 0.06);
  border-color: rgba(245, 158, 11, 0.2);
}

.row--me {
  background: rgba(139, 92, 246, 0.07);
  border-color: rgba(139, 92, 246, 0.2);
}

.row--submitted {
  background: rgba(34, 197, 94, 0.04);
}

.row--skipped {
  opacity: 0.55;
}

.row--spectator {
  opacity: 0.7;
}

/* ─── Avatar ────────────────────────────────────────────────── */
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

/* Force icon to be centered inside UAvatar when no photo is set */
.player-avatar {
  display: flex !important;
  align-items: center;
  justify-content: center;
}

/* Target the inner span/svg that Nuxt UI renders for icon avatars */
.player-avatar :deep(span),
.player-avatar :deep(svg) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.avatar--bot {
  opacity: 0.85;
}

.crown-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 0.7rem;
  color: #f59e0b;
  filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.7));
  line-height: 1;
}

/* ─── Player Info ───────────────────────────────────────────── */
.player-info {
  flex: 1;
  min-width: 0;
}

.player-name-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.player-name {
  font-size: 1rem;
  letter-spacing: 0.04em;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.you-tag {
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  padding: 0 0.3rem;
  line-height: 1.6;
  flex-shrink: 0;
}

/* ─── Status Badges ─────────────────────────────────────────── */
.status-row {
  margin-top: 1px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;

  font-size: 0.62rem;
  letter-spacing: 0.1em;
  padding: 1px 0.35rem;
  border-radius: 4px;
}

.badge--judge {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.badge--submitted {
  color: #4ade80;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.badge--skipped {
  color: #fb923c;
  background: rgba(249, 115, 22, 0.1);
  border: 1px solid rgba(249, 115, 22, 0.2);
}

.badge--spectator {
  color: #a78bfa;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.badge--bot {
  color: #22d3ee;
  background: rgba(34, 211, 238, 0.1);
  border: 1px solid rgba(34, 211, 238, 0.2);
}

.badge--choosing {
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  animation: blink-choosing 2s ease-in-out infinite;
}

@keyframes blink-choosing {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* ─── Score Pill ────────────────────────────────────────────── */
.score-pill {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex-shrink: 0;

  font-size: 0.95rem;
  color: #64748b;
  background: rgba(51, 65, 85, 0.5);
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 6px;
  padding: 0.1rem 0.45rem;
  transition: all 0.25s ease;
}

.score-pill--has-score {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.15);
}

.score-icon {
  font-size: 0.6rem;
  opacity: 0.8;
}

.score-num {
  line-height: 1;
}

/* ─── Admin Actions ─────────────────────────────────────────── */
.admin-actions {
  display: flex;
  gap: 0.1rem;
  flex-shrink: 0;
}
</style>

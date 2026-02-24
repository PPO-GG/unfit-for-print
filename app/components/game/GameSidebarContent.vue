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
  (e: "skip-judge"): void;
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

const humanPlayers = computed(() =>
  props.players.filter((p) => p.playerType !== "bot"),
);
const playerCount = computed(() => props.players.length);
const minPlayers = 3;
const progressPct = computed(() =>
  Math.min(100, (playerCount.value / minPlayers) * 100),
);
const canStart = computed(() => playerCount.value >= minPlayers);
</script>

<template>
  <!-- Single root wrapper — required so flex-gap layout works in the parent scroll container -->
  <div class="sidebar-contents">
    <!-- Mobile header -->
    <div v-if="mobile" class="sidebar-mobile-header">
      <div class="flex items-center gap-2">
        <span class="sidebar-logo-dot" />
        <h2 class="sidebar-title">{{ t("game.game_menu") }}</h2>
      </div>
      <UButton
        icon="i-solar-close-square-bold-duotone"
        color="neutral"
        variant="ghost"
        size="xl"
        :aria-label="t('game.close_menu')"
        @click="emit('close')"
      />
    </div>

    <!-- ═══════════════════════════════════════ -->
    <!-- GAME ROOM WIDGET                        -->
    <!-- ═══════════════════════════════════════ -->
    <div class="game-room-widget">
      <div class="game-room-label">
        <Icon name="solar:gamepad-bold-duotone" class="label-icon" />
        <span>{{ t("lobby.lobby_code") }}</span>
      </div>
      <div class="game-room-code-row">
        <span class="game-room-code">{{ lobby.code }}</span>
        <UButton
          :color="copied ? 'success' : 'primary'"
          :icon="
            copied
              ? 'i-solar-clipboard-check-bold-duotone'
              : 'i-solar-copy-bold-duotone'
          "
          variant="soft"
          size="sm"
          :aria-label="t('lobby.copy_to_clipboard')"
          class="copy-btn"
          @click="emit('copy-link')"
        />
      </div>
      <div class="game-room-divider" />
      <UButton
        class="eject-btn"
        color="error"
        variant="soft"
        trailing-icon="i-solar-exit-bold-duotone"
        block
        @click="emit('leave')"
      >
        {{ t("game.leave_game") }}
      </UButton>
    </div>

    <!-- ═══════════════════════════════════════ -->
    <!-- 2. PLAYERS NEEDED BAR (waiting only)    -->
    <!-- ═══════════════════════════════════════ -->
    <div v-if="isWaiting" class="readiness-bar-wrap">
      <div class="readiness-label">
        <Icon
          name="solar:users-group-rounded-bold-duotone"
          class="text-violet-400"
        />
        <span>
          <span class="readiness-count">{{ playerCount }}</span>
          <span class="readiness-sep">/</span>
          <span class="readiness-min">{{ minPlayers }}</span>
          <span class="readiness-text">
            {{ t("lobby.players_needed_short") ?? "PLAYERS" }}</span
          >
        </span>
      </div>
      <div class="readiness-bar">
        <div
          class="readiness-bar-fill"
          :style="{ width: `${progressPct}%` }"
          :class="{ 'bar-ready': canStart }"
        />
      </div>
    </div>

    <!-- ═══════════════════════════════════════ -->
    <!-- 3. START GAME + BOT CONTROLS            -->
    <!-- ═══════════════════════════════════════ -->
    <div v-if="isWaiting" class="launch-panel">
      <div v-if="canStart">
        <UButton
          v-if="isHost && !isStarting"
          icon="i-solar-play-bold"
          size="xl"
          color="success"
          class="launch-btn"
          block
          @click="emit('start-game')"
        >
          {{ t("lobby.start_game") }}
        </UButton>
        <UButton
          v-else-if="isHost && isStarting"
          :loading="true"
          disabled
          block
          size="xl"
          class="launch-btn"
        >
          {{ t("lobby.starting_game") }}
        </UButton>
        <p
          v-else-if="!isHost && isStarting"
          class="launch-waiting-text text-green-400"
        >
          <Icon name="solar:loading-bold-duotone" class="animate-spin mr-1" />
          {{ t("lobby.starting_game") }}
        </p>
        <p v-else class="launch-waiting-text">
          <Icon
            name="solar:hourglass-bold-duotone"
            class="mr-1 text-violet-400"
          />
          {{ t("lobby.waiting_for_host_start_game") }}
        </p>
      </div>
      <div v-else class="not-enough-panel">
        <Icon
          name="solar:danger-triangle-bold-duotone"
          class="text-amber-400 text-xl"
        />
        <span>{{ t("lobby.players_needed") }}</span>
      </div>

      <div v-if="canAddBot || botPlayers.length > 0" class="bot-controls">
        <UButton
          v-if="canAddBot"
          icon="i-mdi-robot"
          size="md"
          color="info"
          variant="soft"
          class="bot-btn"
          :loading="addingBot"
          :disabled="addingBot"
          block
          @click="addBot"
        >
          {{ t("lobby.add_bot") }}
          <span class="bot-count">({{ botPlayers.length }}/5)</span>
        </UButton>
        <p v-if="botError" class="text-red-400 text-xs mt-1">{{ botError }}</p>
      </div>
    </div>

    <!-- ═══════════════════════════════════════ -->
    <!-- 4. PLAYER LIST                          -->
    <!-- ═══════════════════════════════════════ -->
    <PlayerList
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
      @skip-judge="emit('skip-judge')"
    />

    <!-- ═══════════════════════════════════════ -->
    <!-- 5. CHAT                                 -->
    <!-- ═══════════════════════════════════════ -->
    <ChatBox v-if="joinedLobby" :lobby-id="lobby?.$id || ''" />

    <!-- ═══════════════════════════════════════ -->
    <!-- 6. GAME SETTINGS                        -->
    <!-- ═══════════════════════════════════════ -->
    <GameSettings
      v-if="gameSettings"
      :host-user-id="lobby?.hostUserId || ''"
      :is-editable="isHost"
      :lobby-id="lobby?.$id || ''"
      :settings="gameSettings"
      @update:settings="emit('update:settings', $event)"
    />

    <!-- ═══════════════════════════════════════ -->
    <!-- 7. FOOTER                               -->
    <!-- ═══════════════════════════════════════ -->
    <div class="sidebar-footer" :class="mobile ? 'mb-4' : ''">
      <LanguageSwitcher />
      <VoiceSwitcher />
      <ThemeSwitcher v-if="!mobile" />
    </div>
  </div>
</template>

<style scoped>
/* ─── Root wrapper ──────────────────────────────────────────── */
.sidebar-contents {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  width: 100%;
}

/* ─── Mobile Header ─────────────────────────────────────────── */
.sidebar-mobile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
}

.sidebar-logo-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #8b5cf6;
  box-shadow:
    0 0 8px #8b5cf6,
    0 0 16px #8b5cf688;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    box-shadow:
      0 0 8px #8b5cf6,
      0 0 16px #8b5cf688;
  }
  50% {
    opacity: 0.6;
    box-shadow: 0 0 4px #8b5cf6;
  }
}

.sidebar-title {
  font-size: 1.5rem;
  color: #e2e8f0;
  letter-spacing: 0.08em;
}

/* ─── Game Room Widget ──────────────────────────────────────── */
.game-room-widget {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.12),
    rgba(15, 23, 42, 0.95)
  );
  border: 1px solid rgba(139, 92, 246, 0.35);
  border-radius: 0.875rem;
  padding: 1rem;
  box-shadow:
    0 0 20px rgba(139, 92, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.game-room-label {
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.label-icon {
  color: #8b5cf6;
  font-size: 1rem;
}

.game-room-code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.game-room-code {
  font-size: 2.25rem;
  letter-spacing: 0.2em;
  color: #f1f5f9;
  text-shadow:
    0 0 20px rgba(139, 92, 246, 0.5),
    0 0 40px rgba(139, 92, 246, 0.2);
  line-height: 1;
}

.copy-btn {
  flex-shrink: 0;
}

.game-room-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(139, 92, 246, 0.3),
    transparent
  );
  margin: 0.75rem 0;
}

.eject-btn {
  letter-spacing: 0.08em;
  font-size: 1rem;
}

/* ─── Launch Panel ──────────────────────────────────────────── */
.launch-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.readiness-bar-wrap {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
}

.readiness-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  font-size: 1rem;
  letter-spacing: 0.08em;
  color: #94a3b8;
  margin-bottom: 0.5rem;
}

.readiness-count {
  color: #f1f5f9;
  font-size: 1.2rem;
}
.readiness-sep {
  color: #64748b;
  margin: 0 1px;
}
.readiness-min {
  color: #64748b;
}
.readiness-text {
  color: #94a3b8;
  font-size: 0.85rem;
}

.readiness-bar {
  height: 6px;
  background: rgba(51, 65, 85, 0.8);
  border-radius: 99px;
  overflow: hidden;
}

.readiness-bar-fill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, #7c3aed, #a78bfa);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
}

.readiness-bar-fill.bar-ready {
  background: linear-gradient(90deg, #16a34a, #4ade80);
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
}

.launch-btn {
  font-size: 1.25rem;
  letter-spacing: 0.1em;
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.25);
  transition: box-shadow 0.2s ease;
}

.launch-btn:hover {
  box-shadow: 0 0 30px rgba(34, 197, 94, 0.45);
}

.launch-waiting-text {
  font-size: 1rem;
  letter-spacing: 0.08em;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0.5rem;
}

.not-enough-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  font-size: 1rem;
  letter-spacing: 0.06em;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.06);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 0.65rem;
  padding: 0.6rem 1rem;
}

/* ─── Bot Controls ──────────────────────────────────────────── */
.bot-controls {
  display: flex;
  flex-direction: column;
}

.bot-btn {
  letter-spacing: 0.08em;
  font-size: 1rem;
}

.bot-count {
  font-size: 0.85rem;
  opacity: 0.7;
  margin-left: 0.25rem;
}

/* ─── Chat Section ──────────────────────────────────────────── */
.chat-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.chat-section-header {
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.25rem;
}

/* ─── Footer ────────────────────────────────────────────────── */
.sidebar-footer {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  padding-top: 0.25rem;
  border-top: 1px solid rgba(100, 116, 139, 0.15);
}
</style>

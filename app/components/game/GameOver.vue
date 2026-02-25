<script lang="ts" setup>
import type { Player } from "~/types/player";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import { useNotifications } from "~/composables/useNotifications";
import { useSfx } from "~/composables/useSfx";
import { SFX } from "~/config/sfx.config";
import { gsap } from "gsap";

interface LeaderboardEntry {
  playerId: string;
  points: number;
}

const props = defineProps<{
  leaderboard: LeaderboardEntry[];
  players: Player[];
}>();

const emit = defineEmits(["continue"]);
const { t } = useI18n();
const { markPlayerReturnedToLobby } = useLobby();
const userStore = useUserStore();
const { notify } = useNotifications();

// Get the current user ID
const myId = computed(() => userStore.user?.$id || "");
const { playSfx } = useSfx();

// Auto-return timer
const autoReturnTimeRemaining = ref(60); // 60 seconds countdown
const autoReturnInterval = ref<number | null>(null);

// ── GSAP Refs ────────────────────────────────────────────────────
const containerRef = ref<HTMLElement | null>(null);
const titleRef = ref<HTMLElement | null>(null);
const timerRef = ref<HTMLElement | null>(null);
const trophyRef = ref<HTMLElement | null>(null);
const rowRefs = ref<HTMLElement[]>([]);
const buttonRef = ref<HTMLElement | null>(null);

// ── Score counters (displayed values that roll up) ───────────────
const displayScores = ref<Record<string, number>>({});

// Start the auto-return timer when the component is mounted
onMounted(() => {
  playSfx(SFX.winGame, { volume: 0.8 });
  startAutoReturnTimer();

  // Initialize display scores at 0 for roll-up animation
  props.leaderboard.forEach((entry) => {
    displayScores.value[entry.playerId] = 0;
  });

  // Run the entrance animation
  nextTick(() => {
    runEntranceAnimation();
  });
});

// Clean up the interval when the component is unmounted
onUnmounted(() => {
  if (autoReturnInterval.value) {
    window.clearInterval(autoReturnInterval.value);
  }
});

// ── GSAP Entrance Animation ──────────────────────────────────────
function runEntranceAnimation() {
  const tl = gsap.timeline({
    defaults: { ease: "power3.out" },
  });

  // Container fade in
  if (containerRef.value) {
    tl.fromTo(
      containerRef.value,
      { opacity: 0 },
      { opacity: 1, duration: 0.3 },
      0,
    );
  }

  // Title drops in
  if (titleRef.value) {
    tl.fromTo(
      titleRef.value,
      { opacity: 0, y: -30, scale: 0.8 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.7)" },
      0.1,
    );
  }

  // Timer slides in
  if (timerRef.value) {
    tl.fromTo(
      timerRef.value,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5 },
      0.3,
    );
  }

  // Trophy entrance with bounce
  if (trophyRef.value) {
    tl.fromTo(
      trophyRef.value,
      { opacity: 0, scale: 0, rotation: -20 },
      {
        opacity: 1,
        scale: 1,
        rotation: 0,
        duration: 0.8,
        ease: "elastic.out(1, 0.5)",
      },
      0.4,
    );

    // Winner name count-up for the champion
    const champion = props.leaderboard[0];
    if (champion) {
      const counterObj = { val: 0 };
      tl.to(
        counterObj,
        {
          val: champion.points,
          duration: 1.2,
          ease: "power2.out",
          onUpdate: () => {
            displayScores.value[champion.playerId] = Math.round(counterObj.val);
          },
        },
        0.6,
      );
    }
  }

  // Leaderboard rows cascade in with stagger
  if (rowRefs.value.length > 0) {
    tl.fromTo(
      rowRefs.value,
      { opacity: 0, x: -40, scale: 0.95 },
      {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.5,
        stagger: 0.1,
        ease: "power2.out",
      },
      0.7,
    );

    // Roll up each player's score in parallel with row entrance
    props.leaderboard.forEach((entry, index) => {
      if (index === 0) return; // Champion's score already animated above
      const counterObj = { val: 0 };
      tl.to(
        counterObj,
        {
          val: entry.points,
          duration: 0.8,
          ease: "power2.out",
          onUpdate: () => {
            displayScores.value[entry.playerId] = Math.round(counterObj.val);
          },
        },
        0.7 + index * 0.1,
      );
    });
  }

  // Continue button slides up
  if (buttonRef.value) {
    tl.fromTo(
      buttonRef.value,
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.4)" },
      "-=0.3",
    );
  }
}

// Function to start the auto-return timer
const startAutoReturnTimer = () => {
  // Set the initial time
  autoReturnTimeRemaining.value = 60;

  // Clear any existing interval
  if (autoReturnInterval.value) {
    window.clearInterval(autoReturnInterval.value);
  }

  // Set up a new interval to count down every second
  autoReturnInterval.value = window.setInterval(() => {
    autoReturnTimeRemaining.value--;

    // When timer reaches 0, automatically return to the lobby
    if (autoReturnTimeRemaining.value <= 0) {
      handleContinue();
      window.clearInterval(autoReturnInterval.value!);
    }
  }, 1000);
};

// Function to handle the continue button click
const handleContinue = async () => {
  // Get the lobby ID from the first player (all players should have the same lobby ID)
  const lobbyId = props.players[0]?.lobbyId;

  if (!lobbyId || !myId.value) return;

  try {
    // Mark this player as returned to the lobby
    await markPlayerReturnedToLobby(lobbyId, myId.value);

    // Show notification
    notify({
      title: t("lobby.return_to_lobby"),
      description: t("lobby.scoreboard_return_description"),
      color: "success",
      icon: "i-mdi-check-circle",
    });

    // Emit the continue event to the parent component
    emit("continue");
  } catch (err) {
    console.error("Failed to return to lobby:", err);
    notify({
      title: t("lobby.failed_return_to_lobby"),
      color: "error",
      icon: "i-mdi-alert-circle",
    });
  }
};

// Helper function to get player name from ID
const getPlayerName = (playerId: string) => {
  // First try to find the player in the props.players array by userId
  const playerByUserId = props.players.find(
    (p: Player) => p.userId === playerId,
  );
  if (playerByUserId?.name) {
    return playerByUserId.name;
  }

  // Then try to find the player in the props.players array by $id
  const playerById = props.players.find((p: Player) => p.$id === playerId);
  if (playerById?.name) {
    return playerById.name;
  }

  return t("lobby.unknown_player");
};

// ── Medal helper ─────────────────────────────────────────────────
function getMedal(index: number): string {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}
</script>

<template>
  <div ref="containerRef" class="gameover-container" style="opacity: 0">
    <h2 ref="titleRef" class="gameover-title">
      {{ t("game.game_over") }}
    </h2>

    <!-- Auto-return timer -->
    <div ref="timerRef" class="gameover-timer">
      <p class="gameover-timer-text">
        {{ t("lobby.returning_in", { seconds: autoReturnTimeRemaining }) }}
      </p>
    </div>

    <!-- Winner display -->
    <div class="gameover-winner-section">
      <div
        v-if="leaderboard.length > 0"
        ref="trophyRef"
        class="gameover-trophy"
      >
        <div class="trophy-icon">🏆</div>
        <div class="trophy-name">
          {{ getPlayerName(leaderboard[0]?.playerId ?? "") }}
        </div>
        <div class="trophy-points">
          {{ displayScores[leaderboard[0]?.playerId ?? ""] ?? 0 }}
          {{ t("game.points") }}
        </div>
      </div>
    </div>

    <!-- Leaderboard -->
    <div class="gameover-leaderboard">
      <h3 class="leaderboard-heading">
        {{ t("game.final_scores") }}
      </h3>
      <div class="leaderboard-rows">
        <div
          v-for="(entry, index) in leaderboard"
          :key="entry.playerId"
          :ref="
            (el) => {
              if (el) rowRefs[index] = el as HTMLElement;
            }
          "
          class="leaderboard-row"
          :class="{
            'leaderboard-row--gold': index === 0,
            'leaderboard-row--silver': index === 1,
            'leaderboard-row--bronze': index === 2,
            'leaderboard-row--self': entry.playerId === myId,
          }"
        >
          <div class="row-left">
            <span class="row-medal">{{ getMedal(index) }}</span>
            <span class="row-name">{{ getPlayerName(entry.playerId) }}</span>
          </div>
          <span class="row-score">
            {{ displayScores[entry.playerId] ?? 0 }} pts
          </span>
        </div>
      </div>
    </div>

    <!-- Continue button -->
    <div ref="buttonRef" class="gameover-actions">
      <UButton
        color="primary"
        icon="i-solar-multiple-forward-right-bold-duotone"
        size="lg"
        @click="handleContinue"
      >
        {{ t("game.continue_to_lobby") }}
      </UButton>
    </div>
  </div>
</template>

<style scoped>
/* ═══ GAME OVER SCREEN ═══ */
.gameover-container {
  flex: 1;
  max-width: 48rem;
  margin: 0 auto;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
}

.gameover-title {
  font-size: 2rem;
  font-weight: 800;
  text-align: center;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: linear-gradient(135deg, #f59e0b, #ef4444, #a855f7);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ── Timer ────────────────────────────────────────────────────── */
.gameover-timer {
  background: rgba(51, 65, 85, 0.5);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 0.75rem;
  padding: 1rem 2rem;
  text-align: center;
  backdrop-filter: blur(4px);
}

.gameover-timer-text {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #e2e8f0;
}

/* ── Trophy / Winner Display ─────────────────────────────────── */
.gameover-winner-section {
  width: 100%;
  display: flex;
  justify-content: center;
}

.gameover-trophy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.12) 0%,
    rgba(234, 179, 8, 0.06) 100%
  );
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 1rem;
  position: relative;
  overflow: hidden;
}

.gameover-trophy::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 30%,
    rgba(245, 158, 11, 0.12) 0%,
    transparent 70%
  );
  pointer-events: none;
}

.trophy-icon {
  font-size: 4rem;
  filter: drop-shadow(0 0 20px rgba(245, 158, 11, 0.4));
}

.trophy-name {
  font-size: 1.75rem;
  font-weight: 800;
  color: #fbbf24;
  text-shadow: 0 0 16px rgba(245, 158, 11, 0.3);
}

.trophy-points {
  font-size: 1.25rem;
  font-weight: 600;
  color: rgba(253, 230, 138, 0.9);
  font-variant-numeric: tabular-nums;
}

/* ── Leaderboard ─────────────────────────────────────────────── */
.gameover-leaderboard {
  width: 100%;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(71, 85, 105, 0.3);
  border-radius: 1rem;
  padding: 1.5rem;
  backdrop-filter: blur(4px);
}

.leaderboard-heading {
  font-size: 1.15rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
}

.leaderboard-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.leaderboard-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: rgba(51, 65, 85, 0.4);
  border: 1px solid transparent;
  transition:
    transform 0.15s ease,
    background 0.15s ease;
}

.leaderboard-row:hover {
  transform: translateX(4px);
  background: rgba(51, 65, 85, 0.6);
}

.leaderboard-row--gold {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.3);
}

.leaderboard-row--silver {
  background: rgba(148, 163, 184, 0.1);
  border-color: rgba(148, 163, 184, 0.2);
}

.leaderboard-row--bronze {
  background: rgba(180, 83, 9, 0.1);
  border-color: rgba(180, 83, 9, 0.2);
}

.leaderboard-row--self {
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4) !important;
}

.row-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.row-medal {
  font-size: 1.2rem;
  width: 2rem;
  text-align: center;
}

.row-name {
  font-weight: 600;
  color: #e2e8f0;
}

.row-score {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #fbbf24;
  font-size: 1.1rem;
}

/* ── Actions ─────────────────────────────────────────────────── */
.gameover-actions {
  padding-top: 0.5rem;
}
</style>

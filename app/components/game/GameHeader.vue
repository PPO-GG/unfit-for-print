<script lang="ts" setup>
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { gsap } from "gsap";
import type { Player } from "~/types/player";
import type { GameState } from "~/types/game";
import { getDiscordIdFromPlayer } from "~/utils/discord";

const props = withDefaults(
  defineProps<{
    state?: GameState | null;
    isSubmitting?: boolean;
    isJudging?: boolean;
    isRoundEnd?: boolean;
    isComplete?: boolean;
    judgeId?: string | null;
    players: Player[];
    submissions?: Record<string, string[]>;
    scores?: Record<string, number>;
    maxPoints?: number;
    hostUserId?: string;
    myId?: string;
    roundWinner?: string | null;
    skippedPlayers?: string[];
  }>(),
  {
    state: null,
    isSubmitting: false,
    isJudging: false,
    isRoundEnd: false,
    isComplete: false,
    judgeId: null,
    submissions: () => ({}),
    scores: () => ({}),
    maxPoints: 10,
    hostUserId: "",
    myId: "",
    roundWinner: null,
    skippedPlayers: () => [],
  },
);

const emit = defineEmits<{
  (e: "skip-player", playerId: string): void;
}>();

const { t } = useI18n();

// ── Discord Activity speaking detection ──
const { speakingDiscordIds, isDiscordActivity } = useDiscordSDK();

function isSpeaking(player: Player): boolean {
  if (!isDiscordActivity.value) return false;
  const discordId = getDiscordIdFromPlayer(player);
  return discordId !== null && speakingDiscordIds.value.has(discordId);
}

// ── Round counter flip animation ──
const roundRef = ref<HTMLElement | null>(null);
const phaseRef = ref<HTMLElement | null>(null);

watch(
  () => props.state?.round,
  (newRound, oldRound) => {
    if (!roundRef.value || !newRound || newRound === oldRound) return;
    gsap.fromTo(
      roundRef.value,
      { y: -12, opacity: 0, scale: 1.2 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.45,
        ease: "back.out(2)",
        clearProps: "all",
      },
    );
  },
);

// ── Phase transition animation ──
watch(
  () => props.isSubmitting,
  () => {
    if (!phaseRef.value) return;
    gsap.fromTo(
      phaseRef.value,
      { opacity: 0, scale: 0.95 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: "power2.out",
        clearProps: "all",
      },
    );
  },
);

// ── Elapsed round stopwatch ──
const elapsedSeconds = ref(0);
let timerInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timerInterval = setInterval(() => {
    elapsedSeconds.value += 1;
  }, 1000);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
});

watch(
  () => props.state?.round,
  () => {
    elapsedSeconds.value = 0;
  },
);

const formattedTimer = computed(() => {
  const mins = Math.floor(elapsedSeconds.value / 60);
  const secs = elapsedSeconds.value % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
});

// ── Formatted zero-padded round number ──
const formattedRound = computed(() => {
  const r = props.state?.round || 1;
  return String(r).padStart(2, "0");
});

import confetti from "canvas-confetti";

// ── Submission bounce pulse ──
const previousSubmissions = ref<Set<string>>(new Set());

watch(
  () => props.submissions,
  (newSubs) => {
    if (!newSubs) return;
    const newKeys = new Set(Object.keys(newSubs));
    for (const pid of newKeys) {
      if (!previousSubmissions.value.has(pid)) {
        // New submission: bounce the player pill
        const pillEl = document.querySelector(
          `[data-player-pill="${pid}"]`,
        ) as HTMLElement;
        if (pillEl) {
          gsap.fromTo(
            pillEl,
            { scale: 1 },
            {
              scale: 1.1,
              duration: 0.2,
              yoyo: true,
              repeat: 1,
              ease: "power2.out",
              clearProps: "scale",
            },
          );
        }
      }
    }
    previousSubmissions.value = newKeys;
  },
  { deep: true },
);

// ── Score change pulse on player pill ──
const previousScores = ref<Record<string, number>>({});

watch(
  () => props.scores,
  (newScores) => {
    if (!newScores) return;
    for (const [pid, score] of Object.entries(newScores)) {
      const prev = previousScores.value[pid] ?? 0;
      if (score > prev) {
        const pillEl = document.querySelector(
          `[data-player-pill="${pid}"]`,
        ) as HTMLElement;
        if (pillEl) {
          const scoreBox = pillEl.querySelector(
            ".player-score-box",
          ) as HTMLElement;
          if (scoreBox) {
            gsap.fromTo(
              scoreBox,
              { scale: 1 },
              {
                scale: 1.5,
                duration: 0.3,
                yoyo: true,
                repeat: 1,
                ease: "back.out(2)",
                clearProps: "scale",
              },
            );
          }
        }
      }
    }
    previousScores.value = { ...newScores };
  },
  { deep: true },
);

// ── Confetti burst on winner pill ──
watch(
  () => props.roundWinner,
  (winnerId) => {
    if (!winnerId) return;
    const pillEl = document.querySelector(`[data-player-pill="${winnerId}"]`);
    if (!pillEl) return;

    const rect = pillEl.getBoundingClientRect();
    const originX = (rect.left + rect.width / 2) / window.innerWidth;
    const originY = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
      particleCount: 35,
      spread: 60,
      startVelocity: 18,
      origin: { x: originX, y: originY },
      colors: ["#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#a855f7"],
      gravity: 1.1,
      ticks: 70,
      scalar: 0.75,
    });
  },
);

// ── Helpers ──
function getPlayerScore(playerId: string): number {
  return props.scores?.[playerId] ?? 0;
}

function hasSubmitted(playerId: string): boolean {
  return !!props.submissions?.[playerId];
}

function isPlayerSkipped(playerId: string): boolean {
  return props.skippedPlayers?.includes(playerId) ?? false;
}

function canSkip(player: Player): boolean {
  return (
    !!props.hostUserId &&
    props.hostUserId === props.myId &&
    props.isSubmitting &&
    !hasSubmitted(player.userId) &&
    player.userId !== props.judgeId &&
    player.userId !== props.myId &&
    player.playerType !== "spectator"
  );
}

// ── Dense ranking computation (ties share position) ──
const positionMap = computed(() => {
  const allNonSpectators = props.players.filter(
    (p) => p.playerType !== "spectator",
  );
  const ranked = allNonSpectators
    .map((p) => ({ id: p.userId, score: getPlayerScore(p.userId) }))
    .sort((a, b) => b.score - a.score);

  const map: Record<string, number> = {};
  let position = 1;
  for (let i = 0; i < ranked.length; i++) {
    if (i > 0 && ranked[i]!.score < ranked[i - 1]!.score) {
      position = i + 1;
    }
    map[ranked[i]!.id] = position;
  }
  return map;
});

function getPlayerPosition(playerId: string): number {
  return positionMap.value[playerId] ?? 0;
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"] as const;
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function getPositionBadgeClass(position: number): string {
  switch (position) {
    case 1:
      return "bg-amber-400 text-amber-950 ring-1 ring-yellow-300 font-extrabold";
    case 2:
      return "bg-slate-300 text-slate-900 ring-1 ring-white/80 font-bold";
    case 3:
      return "bg-amber-700 text-amber-100 ring-1 ring-amber-500/60 font-bold";
    default:
      return "bg-slate-800 text-slate-400 ring-1 ring-slate-700/80 font-medium";
  }
}

// ── Deferred sort scores ──────────────────────────────────────────
// GameTable.vue spawns a "+1" badge that arcs from the winning card to
// this pill's on-screen position (~950ms flight — see ScoreFlyBadge.vue).
// If the auto-sort below reacted to `scores` the instant it changes, the
// pill would jump to its new (higher-score) slot immediately and the
// badge would land on an empty spot where the pill used to be. So when a
// score changes because a round winner was just picked, hold the old
// scores for sorting purposes until the badge has had time to land, then
// snap to the real order. Score changes with no winner in flight (initial
// load, reconnect, game reset) apply immediately since there's no badge
// to protect.
const SCORE_FLY_DURATION_MS = 950; // matches ScoreFlyBadge.vue's total tween duration
const sortScores = ref<Record<string, number>>({ ...props.scores });
let sortDeferTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.scores,
  (newScores) => {
    if (!newScores) return;
    if (sortDeferTimer) {
      clearTimeout(sortDeferTimer);
      sortDeferTimer = null;
    }
    if (props.roundWinner) {
      sortDeferTimer = setTimeout(() => {
        sortScores.value = { ...newScores };
        sortDeferTimer = null;
      }, SCORE_FLY_DURATION_MS);
    } else {
      sortScores.value = { ...newScores };
    }
  },
  { deep: true },
);

onUnmounted(() => {
  if (sortDeferTimer) clearTimeout(sortDeferTimer);
});

// ── Auto-sorted player list (descending by score: highest on left) ──
const sortedPlayers = computed(() => {
  return props.players.slice().sort((a, b) => {
    // Spectators to the far right
    if (a.playerType === "spectator" && b.playerType !== "spectator") return 1;
    if (b.playerType === "spectator" && a.playerType !== "spectator") return -1;

    const scoreA = sortScores.value[a.userId] ?? 0;
    const scoreB = sortScores.value[b.userId] ?? 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    // Host priority on ties
    if (a.userId === props.hostUserId) return -1;
    if (b.userId === props.hostUserId) return 1;
    // Alphabetical fallback
    return (a.name || "").localeCompare(b.name || "");
  });
});

// ── Avatar initials and deterministic palette ──
function getInitials(name: string): string {
  if (!name) return "??";
  const trimmed = name.trim();
  const parts = trimmed.split(/[\s_-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0]! + parts[1][0]!).toUpperCase();
  }
  if (trimmed.length >= 2) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  return trimmed.slice(0, 1).toUpperCase();
}

const AVATAR_PALETTES = [
  "bg-indigo-600 text-indigo-100",
  "bg-rose-700 text-rose-100",
  "bg-cyan-600 text-cyan-100",
  "bg-lime-700 text-lime-100",
  "bg-amber-600 text-amber-100",
  "bg-purple-600 text-purple-100",
  "bg-emerald-600 text-emerald-100",
  "bg-sky-600 text-sky-100",
  "bg-fuchsia-600 text-fuchsia-100",
];

function getAvatarPalette(idOrName: string): string {
  let hash = 0;
  for (let i = 0; i < (idOrName || "").length; i++) {
    hash = (hash << 5) - hash + idOrName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index]!;
}

function getPlayerAvatarUrl(player: Player): string | null {
  if (!player?.avatar) {
    return null;
  }
  if (player.avatar.startsWith("http")) {
    return player.avatar;
  }
  if (player.provider === "discord") {
    const parts = player.avatar.split("/");
    if (parts.length === 2) {
      const [discordUserId, avatarHash] = parts;
      return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.png`;
    }
  }
  return null;
}
</script>

<template>
  <header
    class="w-full flex flex-col items-center gap-2 pt-2.5 pb-1 px-4 z-40 relative select-none"
  >
    <!-- ═══ 1. Top Status Pill ═══ -->
    <div
      class="inline-flex items-center gap-2.5 sm:gap-3 px-5 sm:px-6 py-1.5 rounded-full border border-cyan-400/80 bg-[#090e1a]/90 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.2)] text-xs uppercase tracking-widest text-slate-400 font-mono transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:border-cyan-300"
    >
      <!-- Round count -->
      <span class="flex items-center gap-1 font-semibold text-slate-300">
        {{ t("game.round") }}
        <span ref="roundRef" class="round-number font-bold text-cyan-300">{{
          formattedRound
        }}</span>
      </span>

      <span class="text-cyan-500/50 font-bold">·</span>

      <!-- First to target score -->
      <span class="hidden xs:inline text-slate-400">
        {{ t("game.first_to") }} <b class="text-slate-200">{{ maxPoints }}</b>
      </span>

      <span class="hidden xs:inline text-cyan-500/50 font-bold">·</span>

      <!-- Active Phase Label -->
      <span
        ref="phaseRef"
        class="font-display font-extrabold tracking-wider"
        :class="[
          isComplete
            ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.45)]'
            : isRoundEnd
              ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]'
              : isJudging
                ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]'
                : isSubmitting
                  ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]'
                  : 'text-slate-400',
        ]"
      >
        {{
          isComplete
            ? t("game.game_over")
            : isRoundEnd
              ? t("game.round_end")
              : isJudging
                ? t("game.phase_judging")
                : isSubmitting
                  ? t("game.phase_submission")
                  : t("game.waiting")
        }}
      </span>

      <span class="text-cyan-500/50 font-bold">·</span>

      <!-- Round stopwatch / timer -->
      <span class="font-mono text-slate-400 tabular-nums font-semibold">
        {{ formattedTimer }}
      </span>
    </div>

    <!-- ═══ 2. Horizontal Player List Row (Auto-sorted by points) ═══ -->
    <div
      class="w-full flex items-center justify-center gap-2.5 flex-wrap px-2 py-1 max-w-full"
    >
      <TransitionGroup name="player-list">
        <div
          v-for="player in sortedPlayers"
          :key="player.userId || player.$id"
          :data-player-pill="player.userId"
          class="group relative flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-[#0c1224]/90 backdrop-blur-md transition-all duration-300 shrink-0 shadow-md"
          :class="[
            hasSubmitted(player.userId)
              ? 'border-2 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)] ring-1 ring-emerald-500/20'
              : player.userId === judgeId
                ? 'border-2 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)] ring-1 ring-amber-500/20'
                : 'border border-slate-700/70 hover:border-slate-600/90',
            { 'ring-2 ring-emerald-500 animate-pulse': isSpeaking(player) },
          ]"
        >
          <!-- Left: Avatar / Initials Circle -->
          <div class="relative shrink-0 flex items-center justify-center">
            <AvatarDecoration :decoration-id="player.activeDecoration">
              <UAvatar
                v-if="getPlayerAvatarUrl(player)"
                :src="getPlayerAvatarUrl(player)!"
                :alt="player.name"
                size="sm"
                class="w-7 h-7 !w-7 !h-7 rounded-full object-cover"
              />
              <div
                v-else
                class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] uppercase tracking-tight"
                :class="getAvatarPalette(player.name || player.userId)"
              >
                {{ getInitials(player.name) }}
              </div>
            </AvatarDecoration>

            <!-- Position rank badge (e.g. 1st, 2nd, 3rd) -->
            <!-- <div
              v-if="player.playerType !== 'spectator' && getPlayerPosition(player.userId)"
              class="absolute -top-1.5 -left-1.5 text-[8px] px-1 py-0.2 rounded-full leading-none z-10 shadow-xs uppercase tracking-tighter"
              :class="getPositionBadgeClass(getPlayerPosition(player.userId))"
            >
              {{ getOrdinal(getPlayerPosition(player.userId)) }}
            </div> -->
          </div>

          <!-- Middle: Name + Status Subtitle -->
          <div class="flex flex-col min-w-0 justify-center leading-none pr-1">
            <div class="flex items-center gap-1">
              <span
                class="font-display font-bold text-xs uppercase tracking-wider text-slate-100 truncate max-w-[110px]"
                :title="player.name"
              >
                {{ player.name }}
              </span>
              <!-- Host Crown -->
              <Icon
                v-if="player.userId === hostUserId"
                name="solar:crown-minimalistic-bold"
                class="text-amber-400 text-xs shrink-0 drop-shadow-[0_0_4px_rgba(245,158,11,0.6)]"
              />
            </div>

            <!-- Status line -->
            <div
              class="mt-0.5 text-[10px] uppercase tracking-wider font-semibold"
            >
              <span
                v-if="player.userId === judgeId"
                class="text-amber-400 font-bold"
              >
                {{ t("game.judge") }}
              </span>
              <span
                v-else-if="hasSubmitted(player.userId)"
                class="text-emerald-400 flex items-center gap-0.5"
              >
                <span>✓</span> {{ t("game.locked") || "LOCKED" }}
              </span>
              <span
                v-else-if="isPlayerSkipped(player.userId)"
                class="text-orange-400"
              >
                {{ t("game.player_skipped") || "SKIPPED" }}
              </span>
              <span
                v-else-if="player.playerType === 'spectator'"
                class="text-violet-400"
              >
                {{ t("game.spectator") }}
              </span>
              <span
                v-else-if="player.playerType === 'bot'"
                class="text-cyan-400"
              >
                BOT
              </span>
              <span v-else class="text-slate-500 font-medium">
                {{ t("game.picking") || "PICKING" }}
              </span>
            </div>
          </div>

          <!-- Right: Score Box -->
          <div
            v-if="player.playerType !== 'spectator'"
            class="player-score-box bg-slate-900/90 border border-slate-700/60 rounded-md px-2 py-0.5 min-w-[22px] flex items-center justify-center shrink-0 shadow-inner"
          >
            <span
              class="font-bold text-amber-300 text-xs tabular-nums leading-none"
            >
              {{ getPlayerScore(player.userId) }}
            </span>
          </div>

          <!-- Host skip button on hover (submission phase, unsubmitted player) -->
          <button
            v-if="canSkip(player)"
            class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-950 border border-amber-500/80 rounded-full flex items-center justify-center text-amber-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer hover:bg-amber-500/25 hover:border-amber-400 z-20 shadow-md"
            :title="t('game.skip_player')"
            @click.stop="emit('skip-player', player.userId)"
          >
            <UIcon name="i-solar-skip-next-bold-duotone" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </header>
</template>

<style scoped>
.round-number {
  display: inline-block;
  font-variant-numeric: tabular-nums;
}

/* ── Player list FLIP transition when sorting changes ── */
.player-list-move,
.player-list-enter-active,
.player-list-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.player-list-enter-from,
.player-list-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.9);
}

.player-list-leave-active {
  position: absolute;
}
</style>

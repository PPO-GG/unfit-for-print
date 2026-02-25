<script lang="ts" setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { gsap } from "gsap";
import confetti from "canvas-confetti";
import type { Player } from "~/types/player";

const props = defineProps<{
  players: Player[];
  myId: string;
  submissions: Record<string, string[]>;
  judgeId?: string | null;
  scores?: Record<string, number>;
  roundWinner?: string | null;
}>();

const { t } = useI18n();

// ── Participants (excluding self) ───────────────────────────────
const participants = computed(() =>
  props.players.filter(
    (p) => p.playerType !== "spectator" && p.userId !== props.myId,
  ),
);

const MAX_SEATS = 6;
const seatedPlayers = computed(() => participants.value.slice(0, MAX_SEATS));
const overflowPlayers = computed(() => participants.value.slice(MAX_SEATS));

// ── Helpers ─────────────────────────────────────────────────────
function hasSubmitted(playerId: string): boolean {
  return !!props.submissions[playerId];
}

function getPlayerScore(playerId: string): number {
  return props.scores?.[playerId] ?? 0;
}

// ── Seat positioning ────────────────────────────────────────────
function getSeatStyle(index: number, total: number) {
  const fraction = total <= 1 ? 0.5 : index / (total - 1);
  const x = 20 + fraction * 60;
  const arcDepth = 100;
  const yOffset = Math.pow(fraction - 0.5, 2) * 4 * arcDepth;
  return {
    left: `${x}%`,
    top: `${yOffset}px`,
    transform: "translateX(-50%)",
  };
}

// ── Expose seat refs so parent can measure positions for fly-in ──
const seatRefs = ref<Record<string, HTMLElement | null>>({});
defineExpose({ seatRefs });

// ── GSAP: Entrance drop-in ──────────────────────────────────────
const seatsContainerRef = ref<HTMLElement | null>(null);

onMounted(() => {
  nextTick(() => {
    const seatEls = Object.values(seatRefs.value).filter(Boolean);
    if (seatEls.length === 0) return;

    gsap.fromTo(
      seatEls,
      { opacity: 0, y: -30, scale: 0.6 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        stagger: 0.08,
        ease: "back.out(1.7)",
        clearProps: "y,scale",
      },
    );
  });
});

// ── GSAP: Submission bounce pulse ──────────────────────────────
// Track which player IDs have submitted to detect new submissions
const previousSubmissions = ref<Set<string>>(new Set());

watch(
  () => props.submissions,
  (newSubs) => {
    const newKeys = new Set(Object.keys(newSubs));
    for (const pid of newKeys) {
      if (!previousSubmissions.value.has(pid)) {
        // New submission! Bounce the avatar ring
        const seatEl = seatRefs.value[pid];
        if (seatEl) {
          const ring = seatEl.querySelector(".seat-avatar-ring");
          if (ring) {
            gsap.fromTo(
              ring,
              { scale: 1 },
              {
                scale: 1.2,
                duration: 0.15,
                yoyo: true,
                repeat: 1,
                ease: "power2.out",
                clearProps: "scale",
              },
            );
          }
        }
      }
    }
    previousSubmissions.value = newKeys;
  },
  { deep: true },
);

// ── GSAP: Score change golden pulse (winner only) ──────────────
const previousScores = ref<Record<string, number>>({});

watch(
  () => props.scores,
  (newScores) => {
    if (!newScores) return;
    for (const [pid, score] of Object.entries(newScores)) {
      const prev = previousScores.value[pid] ?? 0;
      if (score > prev && pid === props.roundWinner) {
        // Winner's score increased! Pulse only their badge
        const seatEl = seatRefs.value[pid];
        if (seatEl) {
          const badge = seatEl.querySelector(".score-card-badge");
          if (badge) {
            gsap.fromTo(
              badge,
              { scale: 1, opacity: 1, rotate: 12 },
              {
                scale: 1.5,
                opacity: 1,
                rotate: 0,
                duration: 0.3,
                yoyo: true,
                repeat: 1,
                ease: "power2.out",
                onComplete: () => {
                  gsap.set(badge, { clearProps: "all" });
                },
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

// ── Confetti burst on winner's seat ────────────────────────────
watch(
  () => props.roundWinner,
  (winnerId) => {
    if (!winnerId) return;
    const seatEl = seatRefs.value[winnerId];
    if (!seatEl) return;

    // Calculate the seat position as a ratio of the viewport
    const rect = seatEl.getBoundingClientRect();
    const originX = (rect.left + rect.width / 2) / window.innerWidth;
    const originY = (rect.top + rect.height / 2) / window.innerHeight;

    const colors = ["#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#a855f7"];

    // Quick starburst from the winner's seat
    confetti({
      particleCount: 50,
      spread: 70,
      startVelocity: 25,
      origin: { x: originX, y: originY },
      colors,
      gravity: 1.2,
      ticks: 80,
      scalar: 0.8,
    });

    // Second smaller burst slightly delayed for layered effect
    setTimeout(() => {
      confetti({
        particleCount: 30,
        spread: 50,
        startVelocity: 15,
        origin: { x: originX, y: originY },
        colors,
        gravity: 1.0,
        ticks: 60,
        scalar: 0.6,
      });
    }, 150);

    // GSAP: ring glow pulse on the winner's avatar
    const ring = seatEl.querySelector(".seat-avatar-ring");
    if (ring) {
      gsap.fromTo(
        ring,
        {
          boxShadow:
            "0 0 0 3px rgba(245,158,11,0.3), 0 0 0px rgba(245,158,11,0)",
        },
        {
          boxShadow:
            "0 0 0 5px rgba(245,158,11,0.6), 0 0 30px rgba(245,158,11,0.4)",
          duration: 0.4,
          yoyo: true,
          repeat: 2,
          ease: "power2.inOut",
          onComplete: () => {
            gsap.set(ring, { clearProps: "boxShadow" });
          },
        },
      );
    }
  },
);
</script>

<template>
  <!-- Player Seats Arc -->
  <div
    class="fixed top-[110px] left-0 w-full h-[70px] z-40 pointer-events-none"
  >
    <div
      v-for="(player, idx) in seatedPlayers"
      :key="player.userId"
      :ref="
        (el) => {
          if (el) seatRefs[player.userId] = el as HTMLElement;
        }
      "
      class="group absolute flex flex-col items-center gap-0.5 transition-all duration-300 ease-in-out cursor-default pointer-events-auto"
      :style="getSeatStyle(idx, seatedPlayers.length)"
    >
      <!-- Avatar Ring -->
      <div
        class="seat-avatar-ring relative rounded-full p-1 transition-all duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:scale-105"
        :class="[
          hasSubmitted(player.userId)
            ? 'bg-linear-to-br from-green-500/40 to-green-600/25 shadow-[0_0_0_3px_rgba(34,197,94,0.3),0_0_20px_rgba(34,197,94,0.15),0_4px_16px_rgba(0,0,0,0.3)]'
            : player.userId === props.judgeId
              ? 'bg-linear-to-br from-amber-500/35 to-amber-600/20 shadow-[0_0_0_3px_rgba(245,158,11,0.25),0_0_18px_rgba(245,158,11,0.12),0_4px_16px_rgba(0,0,0,0.3)]'
              : 'bg-linear-to-br from-slate-600/60 to-slate-800/90 shadow-[0_0_0_3px_rgba(30,41,59,0.95),0_4px_16px_rgba(0,0,0,0.3)] group-hover:shadow-[0_0_0_3px_rgba(51,65,85,0.95),0_6px_24px_rgba(0,0,0,0.4)]',
        ]"
      >
        <!-- Score card badge (top-right, appears on hover) -->
        <div
          class="score-card-badge absolute -top-1.5 -right-2.5 w-[26px] h-[34px] bg-linear-to-br from-slate-800 to-slate-950 border-[1.5px] border-slate-600/40 rounded-[4px] flex items-center justify-center origin-bottom-left opacity-0 scale-0 rotate-12 transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] z-10 shadow-[0_3px_8px_rgba(0,0,0,0.5)] pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-12"
        >
          <span
            class="text-[0.85rem] text-slate-100/95 tracking-[0.02em] leading-none"
            >{{ getPlayerScore(player.userId) }}</span
          >
        </div>

        <!-- Judge gavel badge -->
        <div
          v-if="player.userId === props.judgeId"
          class="absolute -bottom-1 -left-1.5 w-7 h-7 bg-amber-500/25 border-2 border-amber-500/60 rounded-full flex items-center justify-center text-[0.9rem] text-amber-500 z-10 shadow-[0_0_10px_rgba(245,158,11,0.25)] animate-check-pop"
        >
          <Icon name="mdi:gavel" />
        </div>

        <!-- Submitted checkmark badge -->
        <div
          v-if="hasSubmitted(player.userId)"
          class="seat-check absolute -bottom-0.5 -right-1 w-6 h-6 bg-slate-950/90 border-2 border-green-500/50 rounded-full flex items-center justify-center text-[0.85rem] text-green-500 z-10 animate-check-pop"
        >
          <Icon name="solar:check-circle-bold" />
        </div>

        <UAvatar
          :src="player.avatar || undefined"
          :alt="player.name"
          size="xl"
          class="!w-16 !h-16 text-[1.35rem]"
        />
      </div>

      <!-- Seat Name -->
      <span
        class="text-md tracking-[0.02em] max-w-64 overflow-hidden text-ellipsis whitespace-nowrap text-center transition-colors duration-300 ease-in-out"
        :class="[
          hasSubmitted(player.userId)
            ? 'text-green-500/90'
            : player.userId === props.judgeId
              ? 'text-amber-500/90'
              : 'text-slate-400/90',
        ]"
        >{{ player.name }}</span
      >
    </div>
  </div>

  <!-- Overflow Player List (7+) -->
  <div
    v-if="overflowPlayers.length > 0"
    class="fixed top-[152px] left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-2 p-2 z-40 bg-slate-800/40 rounded-xl max-w-[90%]"
  >
    <div
      v-for="player in overflowPlayers"
      :key="player.userId"
      :ref="
        (el) => {
          if (el) seatRefs[player.userId] = el as HTMLElement;
        }
      "
      class="group/overflow flex items-center gap-1.5 py-1 px-2 rounded-full transition-all duration-300 ease-in-out cursor-default"
      :class="[
        hasSubmitted(player.userId)
          ? 'bg-green-500/10'
          : player.userId === props.judgeId
            ? 'bg-amber-500/10'
            : 'bg-slate-600/50 hover:bg-slate-600/70',
      ]"
    >
      <div class="relative">
        <UAvatar
          :src="player.avatar || undefined"
          :alt="player.name"
          size="sm"
        />
        <div
          class="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-linear-to-br from-slate-800 to-slate-950 border-[1.5px] border-slate-600/40 rounded-[3px] flex items-center justify-center px-[3px] rotate-[10deg] scale-0 opacity-0 transition-all duration-250 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] pointer-events-none text-[0.65rem] text-slate-100/90 z-5 group-hover/overflow:rotate-[10deg] group-hover/overflow:scale-100 group-hover/overflow:opacity-100"
        >
          <span>{{ getPlayerScore(player.userId) }}</span>
        </div>
      </div>
      <span
        class="text-xs text-slate-400/80 max-w-[60px] overflow-hidden text-ellipsis whitespace-nowrap"
        >{{ player.name }}</span
      >
      <Icon
        v-if="hasSubmitted(player.userId)"
        name="solar:check-circle-bold"
        class="text-green-400 text-sm"
      />
      <Icon
        v-if="player.userId === props.judgeId"
        name="mdi:gavel"
        class="text-amber-400 text-sm"
      />
    </div>
  </div>
</template>

<style>
/* check-pop keyframe used by judge & submitted badges */
@keyframes check-pop {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}
.animate-check-pop {
  animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
</style>

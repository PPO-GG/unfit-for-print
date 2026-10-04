<script lang="ts" setup>
import type { Player } from "~/types/player";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";
import { useNotifications } from "~/composables/useNotifications";
import { useSfx } from "~/composables/useSfx";
import { useCompactLayout } from "~/composables/useCompactLayout";
import { getPlayerAvatarUrl } from "~/composables/usePlayerAvatar";
import { SFX } from "~/config/sfx.config";
import { buildPodium, podiumDisplayOrder, type LeaderboardEntry } from "~/utils/podium";
import { gsap } from "gsap";
import { usePreferredReducedMotion } from "@vueuse/core";

const props = defineProps<{
  leaderboard: LeaderboardEntry[];
  players: Player[];
  round: number;
  goal: number;
}>();
const emit = defineEmits<{ continue: [] }>();

const { t } = useI18n();
const { markPlayerReturnedToLobby } = useLobby();
const userStore = useUserStore();
const { notify } = useNotifications();
const { playSfx } = useSfx();
const { isCompact } = useCompactLayout();
const reducedMotion = usePreferredReducedMotion();

const myId = computed(() => userStore.user?.id || "");

// ── Standings ──
const podium = computed(() =>
  buildPodium(props.leaderboard, props.players, t("compact.player_fallback")),
);
const displaySteps = computed(() => podiumDisplayOrder(podium.value.steps));
const winnerNames = computed(
  () => podium.value.steps[0]?.entries.map((e) => e.name).join(" & ") ?? "",
);
const headline = computed(() => t("gameover.wins", { name: winnerNames.value }));
const headlineChars = computed(() => Array.from(headline.value));

function playerFor(id: string): Player | undefined {
  return props.players.find((p) => p.userId === id) ?? props.players.find((p) => p.$id === id);
}
function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// ── Auto-return (unchanged behaviour: 60s, then back to the lobby) ──
const autoReturnTimeRemaining = ref(60);
let autoReturnInterval: number | null = null;

function startAutoReturnTimer() {
  autoReturnTimeRemaining.value = 60;
  if (autoReturnInterval) window.clearInterval(autoReturnInterval);
  autoReturnInterval = window.setInterval(() => {
    autoReturnTimeRemaining.value--;
    if (autoReturnTimeRemaining.value <= 0) {
      if (autoReturnInterval) window.clearInterval(autoReturnInterval);
      handleContinue();
    }
  }, 1000);
}

async function handleContinue() {
  const lobbyId = props.players[0]?.lobbyId;
  if (!lobbyId || !myId.value) return;
  try {
    await markPlayerReturnedToLobby(lobbyId, myId.value);
    notify({
      title: t("lobby.return_to_lobby"),
      description: t("lobby.scoreboard_return_description"),
      color: "success",
      icon: "i-mdi-check-circle",
    });
    emit("continue");
  } catch (err) {
    console.error("Failed to return to lobby:", err);
    notify({ title: t("lobby.failed_return_to_lobby"), color: "error", icon: "i-mdi-alert-circle" });
  }
}

// ── Entrance ──
const rootEl = ref<HTMLElement | null>(null);

function runEntrance() {
  const root = rootEl.value;
  if (!root) return;
  if (reducedMotion.value === "reduce") {
    gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    return;
  }
  const q = (sel: string) => Array.from(root.querySelectorAll(sel));
  const stepFor = (place: number) => root.querySelector(`.go-step[data-place="${place}"] .go-block`);
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.25 })
    .fromTo(q(".go-char"), { opacity: 0, scale: 2.2, y: -20 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(2)", stagger: 0.035 }, 0.1)
    .fromTo(q(".go-kicker"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 }, "-=0.2");
  for (const place of [3, 2, 1]) {
    const block = stepFor(place);
    if (block) {
      tl.fromTo(block, { scaleY: 0, transformOrigin: "bottom center" }, { scaleY: 1, duration: 0.5, ease: "back.out(1.4)" }, "-=0.25");
    }
  }
  tl.fromTo(q(".go-person"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.06 }, "-=0.3")
    .fromTo(q(".go-crown"), { y: -140, opacity: 0, rotation: -25 }, { y: 0, opacity: 1, rotation: 0, duration: 0.8, ease: "bounce.out" }, "-=0.1")
    .call(celebrate)
    .fromTo(q(".go-row"), { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.35, stagger: 0.06 }, "-=0.4")
    .fromTo(q(".go-actions"), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.4)" }, "-=0.2");
}

async function celebrate() {
  if (reducedMotion.value === "reduce") return;
  const iWon = podium.value.steps[0]?.entries.some((e) => e.playerId === myId.value);
  try {
    const { burstConfetti } = await import("~/utils/confetti");
    burstConfetti({ particleCount: iWon ? 160 : 60, spread: iWon ? 110 : 70, origin: { x: 0.5, y: 0.3 } });
  } catch {
    // confetti unavailable — the podium is celebration enough
  }
}

onMounted(() => {
  playSfx(SFX.winGame, { volume: 0.8 });
  startAutoReturnTimer();
  nextTick(runEntrance);
});
onUnmounted(() => {
  if (autoReturnInterval) window.clearInterval(autoReturnInterval);
});
</script>

<template>
  <div ref="rootEl" class="go lobby-tokens" :class="{ 'go--compact': isCompact }">
    <p class="go-kicker">🎉 {{ t("gameover.subtitle", { round, goal }) }}</p>
    <h1 class="go-title" :aria-label="headline">
      <span v-for="(ch, i) in headlineChars" :key="i" class="go-char" aria-hidden="true">{{ ch === " " ? " " : ch }}</span>
    </h1>

    <div class="go-podium">
      <div
        v-for="step in displaySteps"
        :key="step.place"
        class="go-step"
        :class="`go-step--${step.place}`"
        :data-place="step.place"
      >
        <div class="go-people">
          <span v-if="step.place === 1" class="go-crown" aria-hidden="true">👑</span>
          <div
            v-for="e in step.entries"
            :key="e.playerId"
            class="go-person"
            :class="{ 'is-me': e.playerId === myId }"
          >
            <AvatarDecoration :decoration-id="playerFor(e.playerId)?.activeDecoration ?? null">
              <div class="go-avatar">
                <img
                  v-if="getPlayerAvatarUrl(playerFor(e.playerId))"
                  :src="getPlayerAvatarUrl(playerFor(e.playerId))!"
                  alt=""
                  referrerpolicy="no-referrer"
                />
                <span v-else>{{ initials(e.name) }}</span>
              </div>
            </AvatarDecoration>
            <span class="go-name">{{ e.playerId === myId ? t("gameover.you") : e.name }}</span>
          </div>
        </div>
        <div class="go-block">
          <span class="go-place">{{ step.place }}</span>
          <span class="go-points">{{ step.points }}</span>
        </div>
      </div>
    </div>

    <ol v-if="podium.rest.length" class="go-rest">
      <li
        v-for="e in podium.rest"
        :key="e.playerId"
        class="go-row"
        :class="{ 'is-me': e.playerId === myId }"
      >
        <span>{{ e.rank }} · {{ e.name }}</span>
        <span>{{ e.points }}</span>
      </li>
    </ol>

    <div class="go-actions">
      <p class="go-timer">{{ t("lobby.returning_in", { seconds: autoReturnTimeRemaining }) }}</p>
      <button type="button" class="go-continue" @click="handleContinue">
        {{ t("game.continue_to_lobby") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.go {
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: max(1.5rem, env(safe-area-inset-top)) 1rem max(1.5rem, env(safe-area-inset-bottom));
  background: radial-gradient(120% 60% at 50% 10%, #3a3010 0%, #141008 50%, var(--lb-bg-0) 100%);
  color: var(--lb-ink);
  font-family: "Barlow Condensed", sans-serif;
}
.go-kicker {
  margin: 0;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--lb-accent-yellow);
}
.go-title {
  margin: 0;
  text-align: center;
  font-family: "Archivo Black", sans-serif;
  font-size: clamp(2.4rem, 9vw, 6rem);
  line-height: 0.95;
  text-transform: uppercase;
  color: var(--lb-accent-yellow);
  text-shadow: 0 3px 0 #6b5a10, 0 0 30px rgba(245, 212, 66, 0.35);
}
.go-char { display: inline-block; }
.go-podium {
  width: 100%;
  max-width: 44rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.go-step {
  flex: 1 1 0;
  max-width: 14rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.go-people {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.go-crown {
  position: absolute;
  top: -1.9rem;
  left: 50%;
  margin-left: -0.75rem;
  font-size: 1.5rem;
}
.go-person { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
.go-avatar {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--lb-bg-2);
  font-family: "Archivo Black", sans-serif;
}
.go-avatar img { width: 100%; height: 100%; object-fit: cover; }
.go-step--1 .go-avatar {
  width: 4.25rem;
  height: 4.25rem;
  box-shadow: 0 0 0 3px var(--lb-accent-yellow), 0 0 24px rgba(245, 212, 66, 0.5);
}
.go-name {
  font-family: "Archivo Black", sans-serif;
  font-size: 0.8rem;
  text-transform: uppercase;
  text-align: center;
}
.go-person.is-me .go-name { color: var(--lb-accent); }
.go-block {
  width: 100%;
  border-radius: 10px 10px 0 0;
  border: 1px solid var(--lb-line-strong);
  border-bottom: none;
  background: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0 8px, rgba(255, 255, 255, 0.02) 8px 16px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.go-step--1 .go-block { height: 8rem; border-color: var(--lb-accent-yellow); }
.go-step--2 .go-block { height: 5.75rem; }
.go-step--3 .go-block { height: 4.25rem; }
.go-place { font-family: "Archivo Black", sans-serif; font-size: 2rem; color: rgba(255, 255, 255, 0.4); }
.go-step--1 .go-place { color: var(--lb-accent-yellow); }
.go-points { font-family: "JetBrains Mono", monospace; font-size: 0.75rem; color: var(--lb-ink-dim); }
.go-rest {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 28rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.go-row {
  display: flex;
  justify-content: space-between;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--lb-line);
  border-radius: 10px;
  background: rgba(10, 13, 28, 0.7);
  font-weight: 600;
  font-size: 1.05rem;
}
.go-row.is-me { border-color: var(--lb-accent-shadow); color: var(--lb-accent); }
.go-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 28rem;
  margin-top: auto;
}
.go-timer {
  margin: 0;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lb-ink-dim);
}
.go-continue {
  width: 100%;
  min-height: 48px;
  border-radius: 12px;
  background: var(--lb-accent);
  color: var(--lb-bg-0);
  box-shadow: 0 4px 0 var(--lb-accent-shadow);
  font-family: "Archivo Black", sans-serif;
  text-transform: uppercase;
}
.go--compact .go-podium { gap: 0.5rem; }
.go--compact .go-step--1 .go-block { height: 6rem; }
.go--compact .go-step--2 .go-block { height: 4.5rem; }
.go--compact .go-step--3 .go-block { height: 3.25rem; }
.go--compact .go-avatar { width: 2.75rem; height: 2.75rem; }
.go--compact .go-step--1 .go-avatar { width: 3.5rem; height: 3.5rem; }
</style>

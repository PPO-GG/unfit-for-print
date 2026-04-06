<script lang="ts" setup>
import type { Player } from "~/types/player";

const { t } = useI18n();

const props = defineProps<{
  lobbyCode: string;
  players: Player[];
  isHost: boolean;
  isStarting?: boolean;
}>();

const emit = defineEmits<{
  (e: "start-game"): void;
}>();

const config = useRuntimeConfig();
const { notify } = useNotifications();

const copied = ref(false);

function copyLink() {
  if (typeof window === "undefined") return;
  navigator.clipboard
    .writeText(`${config.public.baseUrl}/game/${props.lobbyCode}`)
    .then(() => {
      notify({
        title: t("lobby.code_copied"),
        color: "success",
        icon: "i-mdi-clipboard-check",
      });
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    })
    .catch(() => {
      notify({
        title: t("lobby.error_code_copied"),
        color: "error",
        icon: "i-mdi-alert-circle",
      });
    });
}

// Player count / readiness
const minPlayers = 3;
const playerCount = computed(() => props.players.length);
const canStart = computed(() => playerCount.value >= minPlayers);

// SVG ring progress
const radius = 52;
const circumference = 2 * Math.PI * radius;
const progressOffset = computed(() => {
  const pct = Math.min(1, playerCount.value / minPlayers);
  return circumference * (1 - pct);
});

// Floating card silhouettes — pre-generate random positions
const floatingCards = ref(
  Array.from({ length: 8 }, (_, i) => ({
    id: i,
    left: `${10 + Math.random() * 80}%`,
    top: `${5 + Math.random() * 85}%`,
    delay: `${Math.random() * 8}s`,
    duration: `${12 + Math.random() * 10}s`,
    rotation: Math.random() * 360,
    scale: 0.5 + Math.random() * 0.6,
    opacity: 0.03 + Math.random() * 0.04,
  })),
);
</script>

<template>
  <div class="waiting-hero">
    <!-- Floating card silhouettes -->
    <div class="floating-cards" aria-hidden="true">
      <div
        v-for="card in floatingCards"
        :key="card.id"
        class="floating-card"
        :style="{
          left: card.left,
          top: card.top,
          animationDelay: card.delay,
          animationDuration: card.duration,
          '--rotation': `${card.rotation}deg`,
          '--scale': card.scale,
          opacity: card.opacity,
        }"
      />
    </div>

    <!-- Central content -->
    <div class="hero-content">
      <!-- Logo -->
      <div class="hero-logo-wrap">
        <img
          src="/img/unfit_logo.png"
          alt="Unfit for Print"
          class="hero-logo"
        />
        <div class="hero-logo-glow" />
      </div>

      <!-- Player Count Ring -->
      <div class="hero-ring-section">
        <div class="hero-ring">
          <svg viewBox="0 0 120 120" class="ring-svg">
            <defs>
              <linearGradient
                id="ring-gradient-violet"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stop-color="#7c3aed" />
                <stop offset="100%" stop-color="#a78bfa" />
              </linearGradient>
              <linearGradient
                id="ring-gradient-green"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stop-color="#16a34a" />
                <stop offset="100%" stop-color="#4ade80" />
              </linearGradient>
            </defs>
            <!-- Background track -->
            <circle cx="60" cy="60" :r="radius" class="ring-track" />
            <!-- Progress arc -->
            <circle
              cx="60"
              cy="60"
              :r="radius"
              class="ring-progress"
              :class="{ 'ring-progress--ready': canStart }"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="progressOffset"
            />
          </svg>
          <div class="ring-label">
            <span class="ring-count">{{ playerCount }}</span>
            <span class="ring-sep">/</span>
            <span class="ring-min">{{ minPlayers }}</span>
          </div>
        </div>
        <span class="ring-text">{{ t("lobby.players_needed_short") }}</span>
      </div>

      <!-- Lobby Code + Share -->
      <div class="hero-code-section">
        <span class="hero-code-label">{{ t("lobby.lobby_code") }}</span>
        <div class="hero-code-row">
          <span class="hero-code">{{ lobbyCode }}</span>
          <UButton
            :color="copied ? 'success' : 'primary'"
            :icon="
              copied
                ? 'i-solar-clipboard-check-bold-duotone'
                : 'i-solar-share-bold-duotone'
            "
            variant="soft"
            size="lg"
            :aria-label="t('lobby.copy_to_clipboard')"
            class="share-btn"
            @click="copyLink"
          >
            <span class="share-btn-text">{{
              copied ? t("lobby.code_copied") : t("lobby.share_invite")
            }}</span>
          </UButton>
        </div>
      </div>

      <!-- Status message -->
      <div class="hero-status">
        <template v-if="!canStart">
          <Icon
            name="solar:danger-triangle-bold-duotone"
            class="status-icon status-icon--warn"
          />
          <span class="status-text status-text--warn">{{
            t("lobby.players_needed")
          }}</span>
        </template>
        <template v-else-if="isHost">
          <UButton
            v-if="!isStarting"
            icon="i-solar-play-bold"
            color="success"
            class="w-full h-16 text-lg items-center justify-center"
            @click="emit('start-game')"
          >
            {{ t("lobby.start_game") }}
          </UButton>
          <UButton
            v-else
            :loading="true"
            disabled
            color="success"
            class="w-full h-16 text-lg items-center justify-center"
          >
            {{ t("lobby.starting_game") }}
          </UButton>
        </template>
        <template v-else>
          <Icon
            name="solar:hourglass-bold-duotone"
            class="status-icon status-icon--wait"
          />
          <span class="status-text status-text--wait">{{
            t("lobby.waiting_for_host_start_game")
          }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Root ──────────────────────────────────────────────────────── */
.waiting-hero {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  /* Subtle radial glow behind the content */
  background: radial-gradient(
    ellipse at 50% 40%,
    rgba(139, 92, 246, 0.08) 0%,
    transparent 70%
  );
}

/* ─── Floating card silhouettes ─────────────────────────────────── */
.floating-cards {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.floating-card {
  position: absolute;
  width: 60px;
  height: 84px;
  border-radius: 6px;
  border: 1.5px solid rgba(139, 92, 246, 0.15);
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.06),
    rgba(15, 23, 42, 0.3)
  );
  transform: rotate(var(--rotation)) scale(var(--scale));
  animation: float-drift linear infinite;
}

@keyframes float-drift {
  0% {
    transform: rotate(var(--rotation)) scale(var(--scale)) translateY(0px);
  }
  25% {
    transform: rotate(calc(var(--rotation) + 8deg)) scale(var(--scale))
      translateY(-30px);
  }
  50% {
    transform: rotate(calc(var(--rotation) - 4deg)) scale(var(--scale))
      translateY(-15px);
  }
  75% {
    transform: rotate(calc(var(--rotation) + 5deg)) scale(var(--scale))
      translateY(-35px);
  }
  100% {
    transform: rotate(var(--rotation)) scale(var(--scale)) translateY(0px);
  }
}

/* ─── Central content ───────────────────────────────────────────── */
.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.75rem;
  padding: 2rem;
  max-width: 420px;
}

/* ─── Logo ──────────────────────────────────────────────────────── */
.hero-logo-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-logo {
  width: 200px;
  height: auto;
  filter: drop-shadow(0 0 30px rgba(139, 92, 246, 0.3));
  animation: logo-breathe 4s ease-in-out infinite;
}

.hero-logo-glow {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(139, 92, 246, 0.15) 0%,
    transparent 70%
  );
  animation: glow-pulse 4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes logo-breathe {
  0%,
  100% {
    transform: scale(1);
    filter: drop-shadow(0 0 30px rgba(139, 92, 246, 0.3));
  }
  50% {
    transform: scale(1.03);
    filter: drop-shadow(0 0 45px rgba(139, 92, 246, 0.45));
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

/* ─── Tagline ───────────────────────────────────────────────────── */
.hero-tagline {
  font-size: 0.72rem;
  letter-spacing: 0.25em;
  color: rgba(148, 163, 184, 0.6);
  text-align: center;
  margin-top: -0.75rem;
}

/* ─── Player Count Ring ─────────────────────────────────────────── */
.hero-ring-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.hero-ring {
  position: relative;
  width: 130px;
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  overflow: visible;
}

.ring-track {
  fill: none;
  stroke: rgba(51, 65, 85, 0.5);
  stroke-width: 4;
}

.ring-progress {
  fill: none;
  stroke: url(#ring-gradient-violet);
  stroke-width: 5;
  stroke-linecap: round;
  transition:
    stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1),
    stroke 0.5s ease;
  filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.4));
}

.ring-progress--ready {
  stroke: url(#ring-gradient-green);
  filter: drop-shadow(0 0 8px rgba(74, 222, 128, 0.5));
}

.ring-label {
  display: flex;
  align-items: baseline;
  gap: 2px;
  z-index: 1;
}

.ring-count {
  font-size: 2.5rem;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1;
  text-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
}

.ring-sep {
  font-size: 1.5rem;
  color: #475569;
  margin: 0 1px;
}

.ring-min {
  font-size: 1.25rem;
  color: #64748b;
}

.ring-text {
  font-size: 1.5rem;
  letter-spacing: 0.1em;
  color: #ffffff;
}

/* ─── Lobby Code ────────────────────────────────────────────────── */
.hero-code-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
}

.hero-code-label {
  font-size: 1.5rem;
  letter-spacing: 0.1em;
  color: #ffffff;
}

.hero-code-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 1rem;
  padding: 0.75rem 1rem 0.75rem 1.5rem;
  box-shadow:
    0 0 25px rgba(139, 92, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.hero-code {
  font-size: 2.5rem;
  letter-spacing: 0.22em;
  color: #f1f5f9;
  font-weight: 700;
  text-shadow:
    0 0 25px rgba(139, 92, 246, 0.5),
    0 0 50px rgba(139, 92, 246, 0.2);
  line-height: 1;
}

.share-btn {
  flex-shrink: 0;
  letter-spacing: 0.06em;
}

.share-btn-text {
  display: none;
}

@media (min-width: 640px) {
  .share-btn-text {
    display: inline;
  }
}

/* ─── Status message ────────────────────────────────────────────── */
.hero-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  text-align: center;
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(100, 116, 139, 0.15);
  min-width: 280px;
}

.status-icon {
  font-size: 1.4rem;
}

.status-icon--warn {
  color: #fbbf24;
  animation: icon-bounce 2s ease-in-out infinite;
}

.status-icon--ready {
  color: #4ade80;
  animation: icon-pulse 1.5s ease-in-out infinite;
}

.status-icon--wait {
  color: #a78bfa;
  animation: icon-pulse 2s ease-in-out infinite;
}

@keyframes icon-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@keyframes icon-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  font-size: 0.85rem;
  letter-spacing: 0.06em;
}

.status-text--warn {
  color: #fbbf24;
}

.status-text--ready {
  color: #4ade80;
  font-weight: 600;
}

.status-text--wait {
  color: #94a3b8;
}

.status-hint {
  font-size: 0.7rem;
  color: #475569;
  letter-spacing: 0.04em;
}
</style>

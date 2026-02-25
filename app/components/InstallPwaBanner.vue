<template>
  <Transition name="pwa-banner">
    <div v-if="showBanner" class="pwa-install-banner">
      <div class="pwa-install-banner__content">
        <img
          alt="Unfit for Print"
          class="pwa-install-banner__icon"
          src="/pwa-192x192.png"
        />
        <div class="pwa-install-banner__text">
          <span class="pwa-install-banner__title">Play anytime!</span>
          <span class="pwa-install-banner__subtitle"
            >Install Unfit for Print for a full-screen experience</span
          >
        </div>
      </div>
      <div class="pwa-install-banner__actions">
        <button class="pwa-install-banner__install" @click="handleInstall">
          Install
        </button>
        <button class="pwa-install-banner__dismiss" @click="handleDismiss">
          <Icon name="i-solar-close-circle-bold" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const showBanner = ref(false);

// The $pwa injection from @vite-pwa/nuxt provides install prompt interception
// when `pwa.client.installPrompt = true` is set in nuxt.config.ts.
const pwa = useNuxtApp().$pwa;

onMounted(() => {
  // Only show if the browser fires the beforeinstallprompt event
  // (via the $pwa.showInstallPrompt reactive ref) AND the user
  // hasn't dismissed recently.
  if (!pwa) return;

  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (dismissed) {
    const dismissedAt = Number(dismissed);
    if (Date.now() - dismissedAt < DISMISS_DURATION_MS) return;
  }

  // Watch for the install prompt to become available
  watch(
    () => pwa.showInstallPrompt,
    (canInstall) => {
      if (canInstall) showBanner.value = true;
    },
    { immediate: true },
  );
});

async function handleInstall() {
  if (!pwa) return;
  await pwa.install();
  showBanner.value = false;
}

function handleDismiss() {
  if (pwa) pwa.cancelInstall();
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
  showBanner.value = false;
}
</script>

<style scoped>
/* ── Banner container ───────────────────────────── */
.pwa-install-banner {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  width: calc(100% - 2rem);
  max-width: 28rem;
  padding: 0.75rem 1rem;

  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 1rem;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

/* ── Left side: icon + text ─────────────────────── */
.pwa-install-banner__content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.pwa-install-banner__icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.pwa-install-banner__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.pwa-install-banner__title {
  font-family: var(--font-display);
  font-size: 1rem;
  color: #f1f5f9;
  line-height: 1.2;
}

.pwa-install-banner__subtitle {
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Right side: buttons ────────────────────────── */
.pwa-install-banner__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.pwa-install-banner__install {
  padding: 0.4rem 1rem;
  font-family: var(--font-display);
  font-size: 0.9rem;
  letter-spacing: 0.025em;
  color: #0f172a;
  background: linear-gradient(135deg, #a78bfa 0%, #818cf8 100%);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 150ms ease;
  white-space: nowrap;
}

.pwa-install-banner__install:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
}

.pwa-install-banner__dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  color: #64748b;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: color 150ms ease;
}

.pwa-install-banner__dismiss:hover {
  color: #cbd5e1;
}

/* ── Transition ─────────────────────────────────── */
.pwa-banner-enter-active {
  transition: all 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

.pwa-banner-leave-active {
  transition: all 250ms ease-in;
}

.pwa-banner-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(1.5rem);
}

.pwa-banner-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(1rem);
}
</style>

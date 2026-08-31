<template>
  <Teleport to="body">
    <div v-if="open" class="join-takeover" @click="close">
      <!-- Confetti on successful join -->
      <template v-if="status === 'joined'">
        <span
          v-for="i in 24"
          :key="i"
          class="join-confetti"
          :class="confettiClass(i)"
          :style="confettiStyle(i)"
        />
      </template>

      <div
        ref="cardRef"
        class="join-takeover-card"
        tabindex="0"
        @click.stop="onCardAreaClick"
        @keydown="handleKeydown"
      >
        <button
          type="button"
          class="join-close"
          aria-label="Close"
          @click="close"
        >
          <UIcon name="i-solar-close-circle-bold-duotone" class="size-5" />
        </button>

        <div class="text-center">
          <div class="join-eyebrow">{{ statusEyebrow }}</div>
          <div class="font-display leading-none text-4xl sm:text-5xl mt-1">
            {{ statusHeadline }}
          </div>
        </div>

        <!-- Guest players choose their name before the session is created. -->
        <div
          v-if="needsUsername && status === 'entering'"
          class="join-username"
        >
          <label class="join-label" for="join-username-input">
            {{ t("modal.join_username") }}
          </label>
          <input
            id="join-username-input"
            ref="usernameRef"
            v-model="username"
            type="text"
            maxlength="20"
            autocomplete="off"
            placeholder="RizzMaster69"
            class="join-username-input"
            @keydown.stop
            @keydown.enter.prevent="cardRef?.focus()"
          />
        </div>

        <div class="flex justify-center gap-3 mt-6">
          <div
            v-for="i in 4"
            :key="i"
            class="join-slot"
            :class="{
              filled: !!code[i - 1],
              caret: caretIndex === i - 1 && status === 'entering',
              err: status === 'error',
            }"
          >
            <span class="join-slot-corner join-slot-corner--tl">{{
              String.fromCharCode(64 + i)
            }}</span>
            {{ code[i - 1] || "" }}
            <span class="join-slot-corner join-slot-corner--br">{{
              String.fromCharCode(64 + i)
            }}</span>
          </div>
        </div>

        <div class="join-tray">
          <div
            v-if="status === 'joining'"
            class="flex items-center gap-3 w-full"
          >
            <span class="join-tray-text"
              >Looking up code · {{ fullCode || "····" }}</span
            >
            <span class="join-dots ml-auto"><span /><span /><span /></span>
          </div>

          <div
            v-else-if="status === 'entering'"
            class="w-full flex items-center justify-between flex-wrap gap-3"
          >
            <div class="flex items-center gap-2">
              <span class="join-kbd">⌫</span>
              <span class="join-tray-text">Delete</span>
              <span class="join-kbd" style="margin-left: 10px">ESC</span>
              <span class="join-tray-text">Cancel</span>
            </div>
            <button
              type="button"
              class="join-submit"
              :disabled="!canJoin"
              @click="attemptJoin"
            >
              Join game
              <UIcon name="i-solar-arrow-right-bold-duotone" class="size-4" />
            </button>
          </div>

          <div
            v-else-if="status === 'joined'"
            class="flex items-center gap-3 w-full"
          >
            <span class="join-live-dot bg-success-400" />
            <span class="join-tray-text">Dealing you in…</span>
          </div>

          <div
            v-else-if="status === 'error'"
            class="w-full flex items-center justify-between flex-wrap gap-2"
          >
            <span class="join-tray-text join-tray-text--err">{{
              errorMessage
            }}</span>
            <span class="join-tray-text">Retrying…</span>
          </div>
        </div>

        <div class="mt-4 flex items-center justify-end">
          <button
            type="button"
            class="join-footlink"
            @click="browsePublicLobbies"
          >
            No code? Browse public lobbies
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { requiresJoinUsername } from "~/composables/useUserUtils";
import { useJoinLobby } from "~/composables/useJoinLobby";
import { useUserStore } from "~/stores/userStore";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  "update:open": [boolean];
  joined: [string];
}>();

const { t } = useI18n();
const router = useRouter();
const { joinLobbyWithSession, initSessionIfNeeded } = useJoinLobby();
const userStore = useUserStore();

type Status = "entering" | "joining" | "joined" | "error";

const status = ref<Status>("entering");
const code = ref<string[]>(["", "", "", ""]);
const caretIndex = ref(0);
const username = ref("");
const errorMessage = ref("");
const cardRef = ref<HTMLElement | null>(null);
const usernameRef = ref<HTMLInputElement | null>(null);

const fullCode = computed(() => code.value.join(""));
const needsUsername = computed(() => requiresJoinUsername(userStore.user));
const canJoin = computed(
  () => fullCode.value.length === 4 && (!needsUsername.value || !!username.value.trim()),
);

function resetCode() {
  status.value = "entering";
  code.value = ["", "", "", ""];
  caretIndex.value = 0;
  errorMessage.value = "";
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    resetCode();
    username.value = "";
    await initSessionIfNeeded();
    await nextTick();
    if (needsUsername.value) {
      usernameRef.value?.focus();
    } else {
      cardRef.value?.focus();
    }
  },
);

const authenticatedUsername = computed(() => {
  if (userStore.user && !needsUsername.value) {
    return userStore.user.name || "";
  }
  return "";
});

async function attemptJoin() {
  if (!canJoin.value) return;
  status.value = "joining";

  let name = needsUsername.value
    ? username.value
    : authenticatedUsername.value;
  if (!needsUsername.value && (!name || !name.trim())) {
    let randomSuffix = 0;
    do {
      randomSuffix = crypto.getRandomValues(new Uint32Array(1))[0] as number;
    } while (randomSuffix >= 4294967000);
    randomSuffix %= 1000;
    name = "Player_" + randomSuffix;
  }

  const ok = await joinLobbyWithSession(
    name,
    fullCode.value,
    (msg) => (errorMessage.value = msg),
    () => {},
  );

  if (ok) {
    status.value = "joined";
    emit("joined", fullCode.value);
    setTimeout(close, 550);
  } else {
    status.value = "error";
    setTimeout(() => {
      if (status.value === "error") resetCode();
    }, 1300);
  }
}

// Escape closes regardless of which element has focus. Registered once
// for the component's lifetime (it's always mounted) and gated on
// props.open internally, rather than added/removed per open-state
// change, to avoid any listener churn. Capture phase so the username
// input's @keydown.stop (used to keep letter keys from also being read
// as code-slot input) can't swallow it first.
function onGlobalKeydown(e: KeyboardEvent) {
  if (props.open && e.key === "Escape") close();
}
onMounted(() => window.addEventListener("keydown", onGlobalKeydown, true));
onUnmounted(() => window.removeEventListener("keydown", onGlobalKeydown, true));

function handleKeydown(e: KeyboardEvent) {
  if (status.value !== "entering") return;
  if ((e.target as HTMLElement)?.tagName === "INPUT") return;

  if (e.key === "Enter" && canJoin.value) {
    attemptJoin();
    e.preventDefault();
    return;
  }

  const key = e.key.toUpperCase();
  if (/^[A-Z0-9]$/.test(key) && caretIndex.value < 4) {
    const next = [...code.value];
    next[caretIndex.value] = key;
    code.value = next;
    caretIndex.value = Math.min(caretIndex.value + 1, 4);
    e.preventDefault();
  } else if (e.key === "Backspace") {
    const c = Math.max(caretIndex.value - 1, 0);
    const next = [...code.value];
    next[c] = "";
    code.value = next;
    caretIndex.value = c;
    e.preventDefault();
  }
}

function close() {
  emit("update:open", false);
}

function onCardAreaClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "BUTTON") return;
  cardRef.value?.focus();
}

function browsePublicLobbies() {
  close();
  router.push("/game");
}

const statusEyebrow = computed(() => {
  switch (status.value) {
    case "entering":
      return "Enter the room code";
    case "joining":
      return "Connecting to lobby…";
    case "joined":
      return "Dealing you in!";
    case "error":
      return "That code doesn't exist";
    default:
      return "";
  }
});

const statusHeadline = computed(() => {
  switch (status.value) {
    case "joined":
      return "YOU'RE IN.";
    case "error":
      return "NO DICE.";
    default:
      return "JOIN A GAME";
  }
});

const CONFETTI_CLASSES = [
  "bg-primary-400",
  "bg-info-400",
  "bg-success-400",
  "bg-white",
];

function confettiClass(i: number) {
  return CONFETTI_CLASSES[i % CONFETTI_CLASSES.length];
}

function confettiStyle(i: number) {
  const rand = (seed: number) => {
    const x = Math.sin(seed * 999) * 10000;
    return x - Math.floor(x);
  };
  return {
    left: `${8 + rand(i) * 84}%`,
    top: `${28 + rand(i + 100) * 18}%`,
    animation: `joinConfetti ${1.4 + rand(i + 200) * 0.9}s ease-in ${rand(i + 300) * 0.4}s forwards`,
  };
}
</script>

<style scoped>
.join-takeover {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(5, 6, 13, 0.86);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: joinFadeIn 240ms ease;
}

@keyframes joinFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.join-takeover-card {
  --join-accent: #facc15;
  --join-ink: #f8fafc;
  --join-dim: #8b96b3;
  position: relative;
  width: min(580px, 92vw);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  padding: 42px 32px 24px;
  color: var(--join-ink);
  background:
    repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.018) 0 8px, transparent 8px 18px),
    #0a0d1c;
  box-shadow:
    0 40px 80px -20px rgba(0, 0, 0, 0.85),
    0 0 0 1px rgba(250, 204, 21, 0.1);
  outline: none;
}
.join-takeover-card::before {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  content: "";
  background: var(--join-accent);
}

.join-corner {
  position: absolute;
  color: var(--join-dim);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  line-height: 0.95;
  opacity: 0.5;
}
.join-corner--tl {
  top: 18px;
  left: 20px;
}
.join-corner--br {
  bottom: 18px;
  right: 20px;
  text-align: right;
}

.join-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  transition: opacity 160ms;
}
.join-close:hover {
  opacity: 1;
}

.join-eyebrow {
  color: var(--join-accent);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  opacity: 0.65;
}

.join-username {
  max-width: 320px;
  margin: 24px auto 0;
}
.join-label {
  display: block;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--join-dim);
  margin-bottom: 6px;
  text-align: left;
}
.join-username-input {
  width: 100%;
  text-align: left;
  font-family: "Bebas Neue", sans-serif;
  font-size: 1.35rem;
  letter-spacing: 0.05em;
  padding: 10px 13px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: var(--join-ink);
}
.join-username-input::placeholder {
  color: #56617c;
}
.join-username-input:focus {
  outline: none;
  border-color: var(--join-accent);
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.12);
}

.join-slot {
  width: 72px;
  height: 88px;
  border-radius: 8px;
  border: 1.5px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.035);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Bebas Neue", sans-serif;
  font-size: 48px;
  position: relative;
  transition:
    border-color 160ms,
    background 160ms;
}
.join-slot.filled {
  border-color: var(--join-accent);
  background: rgba(250, 204, 21, 0.1);
  color: var(--join-accent);
  animation: joinSlotPop 300ms cubic-bezier(0.2, 0.8, 0.2, 1.6);
}
.join-slot.caret {
  border-color: var(--join-accent);
  box-shadow: 0 0 0 4px rgba(250, 204, 21, 0.12);
}
.join-slot.err {
  border-color: #7f1d1d;
  color: #7f1d1d;
  animation: joinShake 360ms;
}
.join-slot-corner {
  position: absolute;
  font-family: ui-monospace, monospace;
  font-size: 9px;
  color: var(--join-dim);
  opacity: 0.7;
  letter-spacing: 0.08em;
}
.join-slot-corner--tl {
  top: 6px;
  left: 8px;
}
.join-slot-corner--br {
  bottom: 6px;
  right: 8px;
  transform: rotate(180deg);
}

@keyframes joinSlotPop {
  0% {
    transform: translateY(-10px) scale(0.9);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
@keyframes joinShake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-6px);
  }
  40% {
    transform: translateX(6px);
  }
  60% {
    transform: translateX(-4px);
  }
  80% {
    transform: translateX(4px);
  }
}

.join-tray {
  margin-top: 24px;
  border-radius: 8px;
  padding: 12px 14px;
  min-height: 64px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px dashed rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
}
.join-tray-text {
  font-family: ui-monospace, monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--join-dim);
  opacity: 1;
}
.join-tray-text--err {
  opacity: 1;
  color: #7f1d1d;
}

.join-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  font-family: ui-monospace, monospace;
  font-size: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}

.join-submit {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
  padding: 0.55rem 0.7rem;
  border: 0;
  border-radius: 6px;
  color: #151824;
  background: var(--join-accent);
  box-shadow: 0 3px 0 #a16207;
  cursor: pointer;
  font-family: "Bebas Neue", sans-serif;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: transform 120ms, box-shadow 120ms, opacity 120ms;
}
.join-submit:active { transform: translateY(2px); box-shadow: 0 1px 0 #a16207; }
.join-submit:disabled { cursor: not-allowed; opacity: 0.4; box-shadow: none; }

.join-dots span {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  margin: 0 2px;
  animation: joinDotBounce 1.2s ease-in-out infinite;
}
.join-dots span:nth-child(2) {
  animation-delay: 0.15s;
}
.join-dots span:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes joinDotBounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.join-live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  animation: joinLivePulse 1.6s ease-in-out infinite;
}
@keyframes joinLivePulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(40, 120, 60, 0.5);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(40, 120, 60, 0);
  }
}

.join-footlink {
  font-family: ui-monospace, monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-decoration: underline;
  text-decoration-style: dotted;
  color: var(--join-dim);
  opacity: 1;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  transition: opacity 160ms;
}
.join-footlink:hover {
  opacity: 1;
}

.join-confetti {
  position: absolute;
  width: 8px;
  height: 12px;
  pointer-events: none;
}
@keyframes joinConfetti {
  0% {
    transform: translateY(-20px) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translateY(420px) rotate(720deg);
    opacity: 0;
  }
}

@media (max-width: 520px) {
  .join-takeover { padding: 12px; }
  .join-takeover-card { padding: 40px 18px 20px; }
  .join-slot { width: min(18vw, 64px); height: min(22vw, 78px); font-size: 2.3rem; }
  .join-submit { width: 100%; justify-content: center; margin-left: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .join-takeover, .join-slot, .join-submit { animation: none; transition: none; }
}
</style>

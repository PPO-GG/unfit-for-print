<!--
  Fullscreen "Join Game" takeover modal — port of the prototype's
  JoinGameTakeover. Four big letter slots, auto-submit on fill,
  confetti on success, shake + auto-retry on error.

  Wires to the real join flow:
    1. Look up the lobby by code (`getLobbyByCode`) — bad codes fail
       fast with an "NO DICE." error state.
    2. Once found, show the YOU'RE IN state with the real lobby name.
    3. Join via `useJoinLobby.joinLobbyWithSession` — this also
       navigates to /game/{code} on success.

  The prototype's slot regex accepted letters + digits; we do the same
  so older 6-char hex codes pasted into the first 4 slots still have a
  chance to match a legacy lobby. New lobbies are always 4 letters.
-->
<template>
  <div
    v-if="open"
    class="join-takeover"
    role="dialog"
    aria-modal="true"
    :aria-label="t('brand.join.title')"
    @click="emit('close')"
  >
    <!-- Confetti burst on success -->
    <template v-if="status === 'joined'">
      <span
        v-for="piece in confetti"
        :key="piece.i"
        class="join-confetti"
        :style="piece.style"
      />
    </template>

    <div
      ref="cardRef"
      class="join-takeover-card"
      tabindex="0"
      @click.stop
      @keydown="onKey"
    >
      <div class="join-corner tl">UNFIT<br />FOR<br />PRINT</div>
      <div class="join-corner br">LOBBY<br />ENTRY<br />FORM</div>

      <button type="button" class="join-close" :aria-label="t('brand.join.close')" @click="emit('close')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>

      <div class="text-center">
        <div class="font-mono join-takeover-eyebrow">
          {{ eyebrow }}
        </div>
        <div class="font-display join-takeover-title">
          {{ bigTitle }}
        </div>
      </div>

      <div class="join-takeover-slots">
        <div
          v-for="i in 4"
          :key="i"
          :class="[
            'join-slot',
            {
              filled: !!code[i - 1],
              caret: caret === i - 1 && status === 'entering',
              err: status === 'error',
            },
          ]"
        >
          <span class="join-slot-corner tl">{{ letterLabel(i - 1) }}</span>
          {{ code[i - 1] }}
          <span class="join-slot-corner br">{{ letterLabel(i - 1) }}</span>
        </div>
      </div>

      <!-- Status tray -->
      <div class="join-tray">
        <div v-if="status === 'joining'" class="join-tray-row">
          <div class="join-tray-mono">
            {{ t("brand.join.looking_up") }} · {{ full || "····" }}
          </div>
          <span class="join-dots ml-auto"><span /><span /><span /></span>
        </div>

        <div v-else-if="status === 'entering'" class="join-tray-row join-tray-entering">
          <div class="join-tray-kbd-group">
            <span class="join-kbd">⌫</span>
            <span class="join-tray-mono-70">{{ t("brand.join.delete") }}</span>
            <span class="join-kbd join-tray-esc">ESC</span>
            <span class="join-tray-mono-70">{{ t("brand.join.cancel") }}</span>
          </div>
          <div class="join-tray-mono-70">
            {{ t("brand.join.hint") }}
          </div>
        </div>

        <div v-else-if="status === 'joined'" class="join-tray-row join-tray-joined">
          <div class="join-tray-avatar">{{ joinedInitial }}</div>
          <div>
            <div class="font-display join-tray-lobby-name">{{ joinedLobbyName }}</div>
            <div class="join-tray-mono-70 join-tray-lobby-sub">
              <span class="join-live-dot" />
              {{ t("brand.join.seated") }} · {{ t("brand.join.room") }} {{ full }}
            </div>
          </div>
          <button type="button" class="join-cta ml-auto" @click="navigateToGame">
            {{ t("brand.join.take_seat") }}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <div v-else-if="status === 'error'" class="join-tray-row join-tray-error">
          <div class="join-tray-mono join-tray-error-msg">
            {{ errorMsg || t("brand.join.err_default", { code: full }) }}
          </div>
          <div class="join-tray-mono-70">{{ t("brand.join.retrying") }}</div>
        </div>
      </div>

      <div class="join-takeover-footer">
        <button type="button" class="join-takeover-linklike" @click="onBrowse">
          {{ t("brand.join.browse_public") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useJoinLobby } from "~/composables/useJoinLobby";
import { useLobby } from "~/composables/useLobby";
import { useUserStore } from "~/stores/userStore";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();
const { joinLobbyWithSession, initSessionIfNeeded } = useJoinLobby();
const { getLobbyByCode } = useLobby();

// ─── Local state ───────────────────────────────────────────────
type Status = "entering" | "joining" | "joined" | "error";

const code = ref<string[]>(["", "", "", ""]);
const caret = ref<number>(0);
const status = ref<Status>("entering");
const cardRef = ref<HTMLElement | null>(null);
const joinedLobbyName = ref<string>("");
const errorMsg = ref<string>("");

const full = computed<string>(() => code.value.join(""));

// Matches the prototype's labels (A, B, C, D).
function letterLabel(i: number): string {
  return String.fromCharCode(65 + i);
}

// ─── Open / reset ──────────────────────────────────────────────
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return;
  resetEntry();
  // Init session in the background so joining is snappy.
  void initSessionIfNeeded();
  await nextTick();
  cardRef.value?.focus();
});

function resetEntry() {
  code.value = ["", "", "", ""];
  caret.value = 0;
  status.value = "entering";
  errorMsg.value = "";
}

// ─── Keyboard handling (on the focused card) ──────────────────
function onKey(e: KeyboardEvent) {
  if (status.value !== "entering") return;
  const key = e.key.toUpperCase();

  if (/^[A-Z0-9]$/.test(key) && caret.value < 4) {
    const next = [...code.value];
    next[caret.value] = key;
    code.value = next;
    caret.value = Math.min(caret.value + 1, 4);
    e.preventDefault();
    return;
  }

  if (e.key === "Backspace") {
    const newCaret = Math.max(caret.value - 1, 0);
    const next = [...code.value];
    next[newCaret] = "";
    code.value = next;
    caret.value = newCaret;
    e.preventDefault();
  }
}

// ─── ESC closes (global while open) ───────────────────────────
function onEscape(e: KeyboardEvent) {
  if (e.key === "Escape" && props.open) emit("close");
}

onMounted(() => window.addEventListener("keydown", onEscape));
onBeforeUnmount(() => window.removeEventListener("keydown", onEscape));

// ─── Auto-submit on 4-char fill ───────────────────────────────
watch(full, (v) => {
  if (!props.open) return;
  if (v.length === 4 && status.value === "entering") {
    void submit();
  }
});

async function submit() {
  status.value = "joining";
  const attemptCode = full.value.toUpperCase();

  // 1. Cheap lookup first — if the code doesn't exist, we can show
  //    "NO DICE" without even attempting to join.
  let lobby;
  try {
    lobby = await getLobbyByCode(attemptCode);
  } catch (err: any) {
    console.warn("[BrandJoinTakeover] lookup error", err);
    showError(err?.message || t("brand.join.err_default", { code: attemptCode }));
    return;
  }

  if (!lobby) {
    showError(t("brand.join.err_not_found", { code: attemptCode }));
    return;
  }

  // 2. Show success flash with real lobby info before the actual join.
  joinedLobbyName.value = ((lobby as any).lobbyName || (lobby as any).name || attemptCode).toString().toUpperCase();
  status.value = "joined";

  // 3. Brief sparkle, then actually join + navigate.
  await new Promise(r => setTimeout(r, 900));

  const username = deriveUsername();
  const ok = await joinLobbyWithSession(
    username,
    attemptCode,
    (msg) => { errorMsg.value = msg; },
    () => {},
  );

  if (!ok) {
    showError(errorMsg.value || t("brand.join.err_default", { code: attemptCode }));
  }
  // On success, joinLobbyWithSession already navigated. Closing the
  // modal here keeps state tidy if the route transition is slow.
  emit("close");
}

function deriveUsername(): string {
  const name = userStore.user?.name?.trim();
  if (name) return name;
  // Matches the old JoinLobbyForm fallback for authenticated-but-unnamed
  // sessions (and anonymous ones after initSessionIfNeeded creates a user).
  const suffix = Math.floor(Math.random() * 1000);
  return `Player_${suffix}`;
}

function showError(msg: string) {
  errorMsg.value = msg;
  status.value = "error";
  // Auto-retry to match the prototype UX.
  setTimeout(() => {
    if (status.value !== "error") return;
    resetEntry();
    cardRef.value?.focus();
  }, 1200);
}

// ─── UI derived text ──────────────────────────────────────────
const eyebrow = computed<string>(() => {
  switch (status.value) {
    case "entering": return t("brand.join.eyebrow_entering");
    case "joining":  return t("brand.join.eyebrow_joining");
    case "joined":   return t("brand.join.eyebrow_joined");
    case "error":    return t("brand.join.eyebrow_error");
  }
  return "";
});

const bigTitle = computed<string>(() => {
  switch (status.value) {
    case "joined": return t("brand.join.title_joined");
    case "error":  return t("brand.join.title_error");
    default:       return t("brand.join.title");
  }
});

const joinedInitial = computed<string>(() =>
  (joinedLobbyName.value[0] || "?").toUpperCase(),
);

// ─── Confetti — deterministic-ish layout so SSR/hydration doesn't
//     produce a mismatch. 28 pieces, 4 rotating colors. ────────
const confetti = computed(() => {
  const hues = ["var(--accent)", "var(--accent-3)", "var(--accent-4)", "#f6f3ea"];
  return Array.from({ length: 28 }, (_, i) => ({
    i,
    style: {
      left: `${8 + ((i * 13) % 84)}%`,
      top: `${28 + ((i * 7) % 18)}%`,
      background: hues[i % hues.length],
      animation: `ufp-join-confetti ${1.4 + ((i * 37) % 90) / 100}s ease-in ${((i * 11) % 40) / 100}s forwards`,
    },
  }));
});

// ─── Footer actions ───────────────────────────────────────────
async function navigateToGame() {
  const code = full.value.toUpperCase();
  emit("close");
  await router.push(`/game/${code}`);
}

function onBrowse() {
  emit("close");
  router.push("/game");
}
</script>

<style scoped>
/* These rules live outside .ufp-brand because the `.text-center`
   utility from Tailwind handles alignment — but the brand font
   stack comes from the outer .ufp-brand wrapper. Everything else
   is covered by the .join-* rules in brand.css. */

.join-takeover-eyebrow {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  opacity: 0.6;
  margin-bottom: 8px;
}

.join-takeover-title {
  line-height: 1;
  font-size: 48px;
}

.join-takeover-slots {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
}

.join-tray-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.join-tray-entering {
  justify-content: space-between;
  flex-wrap: wrap;
}

.join-tray-kbd-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.join-tray-esc { margin-left: 10px; }

.join-tray-mono {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  opacity: 0.6;
}

.join-tray-mono-70 {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  opacity: 0.7;
}

.ml-auto { margin-left: auto; }

.join-tray-joined {
  gap: 12px;
}

.join-tray-avatar {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Archivo Black", sans-serif;
  background: #0d0f1a;
  color: var(--accent-2);
}

.join-tray-lobby-name {
  font-size: 18px;
  line-height: 1;
}

.join-tray-lobby-sub {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.join-tray-error {
  justify-content: space-between;
}

.join-tray-error-msg {
  color: #8a0000;
  opacity: 1;
}

.join-takeover-footer {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.join-takeover-linklike {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  text-decoration: underline;
  text-decoration-style: dotted;
  color: rgba(13, 15, 26, 0.7);
  background: transparent;
  border: none;
  cursor: pointer;
}

.text-center { text-align: center; }
</style>

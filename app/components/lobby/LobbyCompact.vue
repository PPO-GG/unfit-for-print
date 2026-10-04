<script setup lang="ts">
import { gsap } from "gsap";
import { usePreferredReducedMotion, useEventListener } from "@vueuse/core";
import type { Player } from "~/types/player";
import type { LobbySettings, ChatMessage } from "~/composables/useLobbyReactive";
import { useLobbyStart, MIN_PLAYERS } from "~/composables/useLobbyStart";
import { useChatUnread } from "~/composables/useChatUnread";
import { useCompactLayout } from "~/composables/useCompactLayout";
import { useReportProblem } from "~/composables/useReportProblem";
import { shareInvite } from "~/utils/shareInvite";

type Tab = "players" | "chat" | "settings";

const props = defineProps<{
  code: string;
  lobbyName: string;
  players: Player[];
  myId: string;
  isHost: boolean;
  isStarting: boolean;
  maxSeats: number;
  settings: LobbySettings | null;
  packNames: Record<string, string>;
  shuffling: boolean;
  chatMessages: ChatMessage[];
}>();
const emit = defineEmits<{
  "toggle-ready": [];
  start: [];
  "add-bot": [];
  kick: [playerId: string];
  leave: [];
  "edit-settings": [];
  "open-app-settings": [];
  shuffle: [];
}>();

const { t } = useI18n();
const { notify } = useNotifications();
const config = useRuntimeConfig();
const { isDiscordActivity } = useDiscordSDK();
const { orientation } = useCompactLayout();
const { open: openReport } = useReportProblem();

// ── Tabs ──
const tab = ref<Tab>("players");
const tabs: Tab[] = ["players", "chat", "settings"];
const { unread } = useChatUnread(
  computed(() => props.chatMessages.length),
  computed(() => tab.value === "chat"),
);

// ── Ready / start ──
const start = useLobbyStart({
  players: toRef(props, "players"),
  myId: toRef(props, "myId"),
  isHost: toRef(props, "isHost"),
  isStarting: toRef(props, "isStarting"),
  onStart: () => emit("start"),
});
const startLabel = computed(() => {
  if (props.isStarting) return t("lobby.compact.starting");
  if (!start.enoughPlayers.value) {
    return t("lobby.compact.need_more", { count: MIN_PLAYERS - props.players.length });
  }
  if (!start.allNonBotsReady.value) {
    return t("lobby.compact.ready_count", {
      ready: start.readyCount.value,
      total: props.players.length,
    });
  }
  if (start.countdown.value !== null && start.countdown.value > 0) {
    return t("lobby.compact.starting_in", { seconds: start.countdown.value });
  }
  return t("lobby.compact.start", { count: props.players.length });
});

const guestHint = computed(() =>
  start.allNonBotsReady.value && start.enoughPlayers.value
    ? t("lobby.compact.waiting_host")
    : t("lobby.compact.ready_count", {
        ready: start.readyCount.value,
        total: props.players.length,
      }),
);

// ── Share ──
async function share() {
  const outcome = await shareInvite(`${config.public.baseUrl}/game/${props.code}`, {
    title: props.lobbyName || t("lobby.compact.untitled"),
    inDiscord: isDiscordActivity.value,
  });
  if (outcome === "copied") {
    notify({ title: t("lobby.compact.share_copied"), color: "success", icon: "i-mdi-clipboard-check" });
  } else if (outcome === "failed") {
    notify({ title: t("lobby.error_code_copied"), color: "error", icon: "i-mdi-alert-circle" });
  }
}

// ── More sheet ──
const moreOpen = ref(false);
function sheet(action: () => void) {
  moreOpen.value = false;
  action();
}

// ── Keyboard-aware height: iOS keeps 100dvh when the keyboard opens, so
// track the visual viewport and size the lobby to it. ──
const vvHeight = ref<string | null>(null);
if (import.meta.client && window.visualViewport) {
  const vv = window.visualViewport;
  const update = () => (vvHeight.value = `${vv.height}px`);
  update();
  useEventListener(vv, "resize", update);
}

// ── Motion ──
const rootEl = ref<HTMLElement | null>(null);
const reduced = usePreferredReducedMotion();
watch(
  () => props.players.length,
  (now, before) => {
    if (reduced.value === "reduce" || now <= (before ?? now)) return;
    nextTick(() => {
      const row = rootEl.value?.querySelector(".lpl-row:last-child");
      if (row) gsap.fromTo(row, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "back.out(1.6)" });
    });
  },
);
watch(start.myReady, () => {
  if (reduced.value === "reduce") return;
  const btn = rootEl.value?.querySelector(".lc-ready");
  if (btn) gsap.fromTo(btn, { scale: 0.9 }, { scale: 1, duration: 0.35, ease: "back.out(3)" });
});
watch(start.canStart, (ok) => {
  if (!ok || reduced.value === "reduce") return;
  const btn = rootEl.value?.querySelector(".lc-start");
  if (btn) gsap.fromTo(btn, { scale: 1 }, { scale: 1.05, duration: 0.25, yoyo: true, repeat: 1, ease: "power1.inOut" });
});
</script>

<template>
  <div
    ref="rootEl"
    class="lc"
    :class="`lc--${orientation}`"
    :style="vvHeight ? { height: vvHeight } : undefined"
  >
    <header class="lc-head">
      <p class="lc-meta">
        {{ lobbyName || t("lobby.compact.untitled") }} ·
        {{ t("lobby.compact.seats", { count: players.length, max: maxSeats }) }}
      </p>
      <button type="button" class="lc-code-btn" @click="share">
        <span class="lc-code">{{ code }}</span>
        <span class="lc-share">{{ t("lobby.compact.share") }}</span>
      </button>
    </header>

    <nav class="lc-tabs" role="tablist">
      <button
        v-for="name in tabs"
        :key="name"
        type="button"
        role="tab"
        class="lc-tab"
        :class="{ on: tab === name }"
        :id="`lc-tab-${name}`"
        :aria-controls="`lc-panel-${name}`"
        :aria-selected="tab === name"
        :data-tab="name"
        @click="tab = name"
      >
        {{ t(`lobby.compact.${name}`) }}
        <span v-if="name === 'chat' && unread > 0" class="lc-badge">{{ unread }}</span>
      </button>
    </nav>

    <section class="lc-panel" role="tabpanel" :id="`lc-panel-${tab}`" :aria-labelledby="`lc-tab-${tab}`">
      <LobbyPlayerList
        v-if="tab === 'players'"
        :players="players"
        :max-seats="maxSeats"
        :is-host-user="isHost"
        @add-bot="emit('add-bot')"
        @kick="(id: string) => emit('kick', id)"
      />
      <LobbyChat v-else-if="tab === 'chat'" class="lc-chat" :messages="chatMessages" />
      <div v-else class="lc-settings">
        <LobbySettingsSummary
          :settings="settings"
          :is-host="isHost"
          :shuffling="shuffling"
          :pack-names="packNames"
          @edit="emit('edit-settings')"
          @shuffle="emit('shuffle')"
        />
        <LobbyRoundPreview
          :cards-per-player="settings?.cardsPerPlayer ?? 0"
          :max-pick="settings?.maxPick ?? 0"
          :active-packs-count="(settings?.cardPacks ?? []).length"
        />
      </div>
    </section>

    <footer class="lc-bar">
      <p v-if="!isHost" class="lc-hint">{{ guestHint }}</p>
      <button type="button" class="lc-btn lc-more" :aria-label="t('lobby.compact.more')" @click="moreOpen = true">⋯</button>
      <button
        type="button"
        class="lc-btn lc-ready"
        :class="{ on: start.myReady.value, grow: !isHost }"
        @click="emit('toggle-ready')"
      >
        {{ start.myReady.value ? t("lobby.compact.ready") : t("lobby.compact.ready_up") }}
      </button>
      <button
        v-if="isHost"
        type="button"
        class="lc-btn lc-start grow"
        :disabled="!start.canStart.value || isStarting"
        @click="start.handleStart()"
      >
        {{ startLabel }}
      </button>
    </footer>

    <UDrawer v-model:open="moreOpen" direction="bottom" :title="t('lobby.compact.more')" :ui="{ content: 'lobby-tokens' }">
      <template #body>
        <div class="lc-sheet">
          <button type="button" class="lc-sheet-btn lc-sheet-leave" @click="sheet(() => emit('leave'))">↩ {{ t("lobby.compact.leave") }}</button>
          <button v-if="isHost" type="button" class="lc-sheet-btn lc-sheet-bot" @click="sheet(() => emit('add-bot'))">🤖 {{ t("lobby.compact.add_bot") }}</button>
          <button type="button" class="lc-sheet-btn lc-sheet-app" @click="sheet(() => emit('open-app-settings'))">🔧 {{ t("lobby.compact.app_settings") }}</button>
          <button type="button" class="lc-sheet-btn lc-sheet-report" @click="sheet(openReport)">⚠ {{ t("report.title", "Report a Problem") }}</button>
        </div>
      </template>
    </UDrawer>
  </div>
</template>

<style scoped>
.lc {
  position: relative;
  z-index: 1;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  grid-template-areas: "head" "tabs" "panel" "bar";
  padding-top: env(safe-area-inset-top);
  font-family: "Barlow Condensed", sans-serif;
  color: var(--lb-ink);
  overscroll-behavior: none;
}
.lc--landscape {
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas: "head panel" "tabs panel" "tabs bar";
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
.lc-head { grid-area: head; text-align: center; padding: 10px 16px 4px; }
.lc-meta {
  margin: 0;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lb-ink-dim);
}
.lc-code-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-height: 44px;
  padding: 4px 0;
}
.lc-code {
  font-family: "JetBrains Mono", monospace;
  font-size: 2rem;
  letter-spacing: 0.25em;
  color: var(--lb-accent);
  text-shadow: 0 0 18px color-mix(in oklch, var(--lb-accent-shadow) 50%, transparent);
}
.lc-share {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--lb-accent);
}
.lc-tabs {
  grid-area: tabs;
  display: flex;
  margin: 0 12px;
  border-bottom: 1px solid var(--lb-line-strong);
}
.lc--landscape .lc-tabs {
  flex-direction: column;
  border-bottom: none;
  align-self: start;
}
.lc-tab {
  position: relative;
  flex: 1;
  min-height: 44px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lb-ink-muted);
  border-bottom: 2px solid transparent;
}
.lc-tab.on { color: var(--lb-ink); border-bottom-color: var(--lb-accent); }
.lc-badge {
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--lb-accent-pink);
  color: var(--lb-bg-0);
}
.lc-panel {
  grid-area: panel;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px;
  -webkit-overflow-scrolling: touch;
}
.lc-panel :deep(.lpl-kick) { min-width: 44px; min-height: 44px; }
.lc-panel :deep(.lpl-add-bot-link) { min-height: 44px; padding: 0 12px; }
.lc-chat { height: 100% !important; }
.lc-settings { display: flex; flex-direction: column; gap: 10px; }
.lc-bar {
  grid-area: bar;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px max(14px, env(safe-area-inset-bottom));
  background: linear-gradient(transparent, var(--lb-bg-0) 30%);
}
.lc-hint {
  flex-basis: 100%;
  margin: 0;
  text-align: center;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lb-ink-dim);
}
.lc-btn {
  min-height: 48px;
  min-width: 48px;
  border-radius: 12px;
  border: 1px solid var(--lb-line-strong);
  font-family: "Archivo Black", sans-serif;
  font-size: 0.85rem;
  text-transform: uppercase;
  color: var(--lb-ink);
  padding: 0 14px;
}
.lc-btn.grow { flex: 1; }
.lc-ready.on { border-color: var(--lb-accent-lime); color: var(--lb-accent-lime); }
.lc-start {
  background: var(--lb-accent-lime);
  color: var(--lb-bg-0);
  border-color: transparent;
  box-shadow: 0 4px 0 oklch(60% 0.2 140);
}
.lc-start:disabled {
  background: var(--lb-bg-2);
  color: var(--lb-ink-dim);
  box-shadow: none;
  border-color: var(--lb-line);
}
.lc-sheet { display: flex; flex-direction: column; gap: 8px; }
.lc-sheet-btn {
  min-height: 48px;
  text-align: left;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--lb-line-strong);
  font-weight: 600;
  font-size: 1.05rem;
  color: var(--lb-ink);
}
</style>

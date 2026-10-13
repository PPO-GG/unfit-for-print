<template>
  <footer class="lobby-startbar lobby-panel" :class="frameClass">
    <div class="lsb-utils">
      <button
        class="lb-btn lb-btn--quiet lb-btn--icon lsb-leave"
        :aria-label="t('lobby.bar.leave')"
        :title="t('lobby.bar.leave')"
        @click="$emit('leave')"
      >
        <UIcon name="i-solar-logout-2-bold-duotone" />
      </button>
      <button
        class="lb-btn lb-btn--quiet lb-btn--icon lsb-app-settings"
        :aria-label="t('lobby.bar.app_settings')"
        :title="t('lobby.bar.app_settings')"
        @click="$emit('open-app-settings')"
      >
        <UIcon name="i-solar-settings-bold-duotone" />
      </button>
    </div>

    <div class="lsb-divider" aria-hidden="true" />

    <ol class="lsb-pips" :aria-label="t('lobby.bar.pips_label')">
      <li
        v-for="pl in shownPips"
        :key="pl.$id"
        class="lsb-pip"
        :class="{ 'lsb-pip--ready': isReady(pl) }"
        :style="{ '--pip': playerAccent(pl) }"
        :title="pl.name"
      >
        {{ playerInitials(pl) }}
      </li>
      <li v-if="extraPips > 0" class="lsb-pip lsb-pip--more">+{{ extraPips }}</li>
    </ol>

    <div class="lsb-status">
      <div class="lsb-label-main">{{ stateLabel }}</div>
      <div v-if="stateSubLabel" class="lsb-label-sub">{{ stateSubLabel }}</div>
    </div>

    <div class="lsb-spacer" />

    <div class="lsb-actions">
      <button
        v-if="!myReady"
        class="lb-btn lb-btn--primary lsb-ready"
        @click="$emit('toggle-ready')"
      >
        <UIcon name="i-solar-check-circle-bold-duotone" />
        {{ t("lobby.bar.ready_up") }}
      </button>
      <button
        v-else
        class="lb-btn lb-btn--secondary lsb-unready"
        @click="$emit('toggle-ready')"
      >
        <UIcon name="i-solar-close-circle-bold-duotone" />
        {{ t("lobby.bar.not_ready") }}
      </button>

      <button
        v-if="isHost && myReady"
        class="lb-btn lsb-start"
        :class="canStart ? 'lb-btn--primary' : 'lb-btn--secondary'"
        :disabled="!canStart || isStarting"
        @click="handleStart"
      >
        <UIcon name="i-solar-play-bold" />
        <template v-if="isStarting">{{ t("lobby.bar.starting") }}</template>
        <template v-else-if="canStart && countdown !== null && countdown > 0">
          {{ t("lobby.bar.start_now", { seconds: countdown }) }}
        </template>
        <template v-else>{{ t("lobby.bar.start") }}</template>
      </button>
    </div>
  </footer>
</template>

<script lang="ts" setup>
import { toRef } from "vue";
import type { Player } from "~/types/player";
import { useLobbyStart, MIN_PLAYERS } from "~/composables/useLobbyStart";
import { playerAccent, playerInitials } from "~/utils/playerColor";

const MAX_PIPS = 10;
const MAX_NAMES = 3;

const props = defineProps<{
  players: Player[];
  myId: string;
  isHost: boolean;
  isStarting: boolean;
}>();

const emit = defineEmits<{
  (e: "leave"): void;
  (e: "open-app-settings"): void;
  (e: "toggle-ready"): void;
  (e: "start"): void;
}>();

const { t } = useI18n();

const {
  enoughPlayers,
  readyCount,
  canStart,
  myReady,
  countdown,
  waitingOn,
  handleStart,
} = useLobbyStart({
  players: toRef(props, "players"),
  myId: toRef(props, "myId"),
  isHost: toRef(props, "isHost"),
  isStarting: toRef(props, "isStarting"),
  onStart: () => emit("start"),
});

function isReady(p: Player): boolean {
  return p.playerType === "bot" || !!p.ready;
}

const shownPips = computed(() => props.players.slice(0, MAX_PIPS));
const extraPips = computed(() => Math.max(0, props.players.length - MAX_PIPS));

const stateLabel = computed(() => {
  if (props.isStarting) return t("lobby.bar.dealing");
  if (!enoughPlayers.value) {
    return t("lobby.bar.need_more", { count: Math.max(0, MIN_PLAYERS - props.players.length) });
  }
  // The countdown only arms on a false → true flip of canStart, so a room that
  // loads already all-ready has canStart with no countdown. Show the count
  // there rather than claiming cards are being dealt.
  if (canStart.value && countdown.value !== null && countdown.value > 0) {
    return t("lobby.bar.starting_in", { seconds: countdown.value });
  }
  return t("lobby.bar.ready_count", { ready: readyCount.value, total: props.players.length });
});

const stateSubLabel = computed(() => {
  if (props.isStarting) return "";
  if (!enoughPlayers.value) return t("lobby.bar.need_more_sub");
  if (canStart.value) return t("lobby.bar.everyone_in");
  const names = waitingOn.value
    .slice(0, MAX_NAMES)
    .map((p) => (p.userId === props.myId ? t("lobby.bar.you") : p.name))
    .join(", ");
  const extra = waitingOn.value.length - MAX_NAMES;
  const more = extra > 0 ? ` ${t("lobby.bar.and_more", { count: extra })}` : "";
  return `${t("lobby.bar.waiting_on", { names })}${more}`;
});

const frameClass = computed(() => {
  if (canStart.value) return "lsb--go";
  if (enoughPlayers.value) return "lsb--enough";
  return "";
});
</script>

<style scoped>
.lobby-startbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  margin: 0 20px 14px;
  flex-shrink: 0;
  border-color: var(--lb-line-strong);
  transition: border-color 240ms ease, box-shadow 240ms ease;
}
.lsb--enough { border-color: var(--lb-accent); box-shadow: 0 0 30px -15px var(--lb-accent); }
.lsb--go { border-color: var(--lb-accent-lime); box-shadow: 0 0 40px -10px var(--lb-accent-lime); }

.lsb-utils { display: flex; gap: 4px; }
.lsb-divider { width: 1px; height: 28px; background: var(--lb-line-strong); }

.lsb-pips { display: flex; gap: 5px; margin: 0; padding: 0; list-style: none; }
.lsb-pip {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--pip);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Archivo Black', sans-serif;
  font-size: 9px;
  color: var(--lb-ink-dim);
  opacity: 0.55;
  transition: background 200ms ease, opacity 200ms ease, color 200ms ease;
}
.lsb-pip--ready { background: var(--pip); color: #0d0f1a; opacity: 1; }
.lsb-pip--more { --pip: var(--lb-line-strong); opacity: 1; color: var(--lb-ink-dim); }

.lsb-status { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.lsb-label-main {
  font-family: 'Archivo Black', sans-serif;
  font-size: 15px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--lb-ink);
  line-height: 1;
}
.lsb-label-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lb-ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lsb-spacer { flex: 1; }
.lsb-actions { display: flex; align-items: center; gap: 8px; }

@media (prefers-reduced-motion: reduce) {
  .lobby-startbar, .lsb-pip { transition: none; }
}
</style>

<script setup lang="ts">
import type { Player } from "~/types/player";
import { getPlayerAvatarUrl } from "~/composables/usePlayerAvatar";

const props = defineProps<{
  players: Player[];
  judgeId: string | null;
  /** Players shown with a "locked in" check this phase. */
  lockedIds: string[];
  pillLabel: string;
  pillTone: "cyan" | "yellow" | "lime" | "muted";
  unread: number;
}>();
const emit = defineEmits<{ menu: []; chat: [] }>();
const { t } = useI18n();

const MAX_AVATARS = 6;
const active = computed(() =>
  props.players.filter((p) => p.playerType !== "spectator"),
);
const shown = computed(() => active.value.slice(0, MAX_AVATARS));
const overflow = computed(() => Math.max(0, active.value.length - MAX_AVATARS));

function displayName(p: Player): string {
  return p.name?.trim() || t("compact.player_fallback");
}
function initials(p: Player): string {
  return displayName(p).slice(0, 2).toUpperCase();
}
</script>

<template>
  <header class="ctb">
    <button type="button" class="ctb-icon ctb-menu" :aria-label="t('compact.menu')" @click="emit('menu')">
      <Icon name="i-solar-hamburger-menu-broken" />
    </button>
    <span class="ctb-pill" :class="`ctb-pill--${pillTone}`">{{ pillLabel }}</span>
    <div class="ctb-avatars">
      <span
        v-for="p in shown"
        :key="p.userId"
        class="ctb-av"
        :class="{ 'is-judge': p.userId === judgeId }"
        :data-player="p.userId"
        :title="displayName(p)"
      >
        <img v-if="getPlayerAvatarUrl(p)" :src="getPlayerAvatarUrl(p)!" alt="" />
        <span v-else>{{ initials(p) }}</span>
        <i v-if="lockedIds.includes(p.userId)" class="ctb-check" aria-hidden="true">✓</i>
      </span>
      <span v-if="overflow" class="ctb-av ctb-av--more">+{{ overflow }}</span>
    </div>
    <button type="button" class="ctb-icon ctb-chat" :aria-label="t('compact.chat')" @click="emit('chat')">
      <Icon name="i-solar-chat-round-dots-bold-duotone" />
      <span v-if="unread > 0" class="ctb-badge">{{ unread }}</span>
    </button>
  </header>
</template>

<style scoped>
.ctb {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  min-width: 0;
}
.ctb-icon {
  position: relative;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--lb-line-strong);
  display: grid;
  place-items: center;
  font-size: 20px;
  color: var(--lb-ink);
}
.ctb-pill {
  flex: none;
  border: 1px solid var(--lb-line-strong);
  border-radius: 999px;
  padding: 4px 10px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--lb-ink-dim);
  white-space: nowrap;
}
.ctb-pill--cyan { color: var(--lb-accent); border-color: var(--lb-accent-shadow); }
.ctb-pill--yellow { color: var(--lb-accent-yellow); border-color: oklch(62% 0.18 95); }
.ctb-pill--lime { color: var(--lb-accent-lime); border-color: oklch(60% 0.2 140); }
.ctb-avatars {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  overflow: hidden;
}
.ctb-av {
  position: relative;
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--lb-bg-2);
  border: 2px solid var(--lb-bg-1);
  font-family: "Archivo Black", sans-serif;
  font-size: 10px;
  color: var(--lb-ink);
}
.ctb-av img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.ctb-av.is-judge {
  box-shadow: 0 0 0 2px var(--lb-accent-yellow);
}
.ctb-check {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--lb-accent-lime);
  color: var(--lb-bg-0);
  font-size: 9px;
  font-style: normal;
}
.ctb-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--lb-accent-pink);
  color: var(--lb-bg-0);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  display: grid;
  place-items: center;
}
</style>

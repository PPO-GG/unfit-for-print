<template>
  <article
    v-if="player"
    class="lpc"
    :class="{ 'lpc--ready': ready, 'lpc--me': isMe, 'lpc--bot': isBot }"
    :style="{ '--lpc-accent': accent }"
  >
    <div class="lpc-top">
      <AvatarDecoration :decoration-id="player.activeDecoration ?? null">
        <div
          class="lpc-avatar"
          :class="{ 'lpc-avatar--image': showImage }"
          :style="showImage ? undefined : playerAvatarStyle(player)"
        >
          <img
            v-if="showImage"
            :src="avatarUrl ?? ''"
            :alt="player.name"
            referrerpolicy="no-referrer"
            @error="imgError = true"
          />
          <span v-else>{{ playerInitials(player) }}</span>
        </div>
      </AvatarDecoration>
      <span v-if="isBot" class="lpc-tag lpc-tag--bot">{{ t("lobby.cards.bot") }}</span>
      <span v-else-if="isMe" class="lpc-tag lpc-tag--me">{{ t("lobby.cards.you") }}</span>
    </div>

    <span v-if="ready && !isBot" class="lpc-stamp" aria-hidden="true">
      {{ t("lobby.cards.ready_stamp") }}
    </span>

    <div class="lpc-body">
      <div class="lpc-name">
        <span class="lpc-name-text">{{ player.name }}</span>
        <span v-if="player.isHost" :title="t('lobby.cards.host')">👑</span>
      </div>
      <div class="lpc-status">{{ statusLabel }}</div>
    </div>

    <button
      v-if="isHostUser && !player.isHost"
      class="lpc-kick"
      :aria-label="t('lobby.cards.remove', { name: player.name })"
      :title="t('lobby.cards.remove', { name: player.name })"
      @click="$emit('kick', player.$id)"
    >
      <UIcon name="i-solar-close-circle-bold" />
    </button>
  </article>

  <div v-else class="lpc lpc--open">
    <span class="lpc-open-plus" aria-hidden="true">+</span>
    <div class="lpc-open-label">{{ t("lobby.cards.open_seat") }}</div>
    <div class="lpc-open-actions">
      <button
        v-if="isHostUser"
        class="lb-btn lb-btn--secondary lb-btn--sm lpc-add-bot"
        @click="$emit('add-bot')"
      >
        {{ t("lobby.cards.add_bot") }}
      </button>
      <button class="lb-btn lb-btn--secondary lb-btn--sm lpc-invite" @click="$emit('invite')">
        {{ t("lobby.cards.invite") }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Player } from "~/types/player";
import { getPlayerAvatarUrl } from "~/composables/usePlayerAvatar";
import { playerAccent, playerAvatarStyle, playerInitials } from "~/utils/playerColor";

const props = defineProps<{
  player: Player | null;
  isHostUser: boolean;
  isMe?: boolean;
}>();

defineEmits<{
  (e: "kick", playerId: string): void;
  (e: "add-bot"): void;
  (e: "invite"): void;
}>();

const { t } = useI18n();

const imgError = ref(false);
const avatarUrl = computed(() => getPlayerAvatarUrl(props.player));
watch(avatarUrl, () => { imgError.value = false; });
const showImage = computed(() => !!avatarUrl.value && !imgError.value);

const isBot = computed(() => props.player?.playerType === "bot");
const ready = computed(() => isBot.value || !!props.player?.ready);
const accent = computed(() => (props.player ? playerAccent(props.player) : ""));

const statusLabel = computed(() => {
  if (isBot.value) return t("lobby.cards.always_ready");
  return ready.value ? t("lobby.cards.ready") : t("lobby.cards.thinking");
});
</script>

<style scoped>
.lpc {
  position: relative;
  width: 100%;
  max-width: var(--lpc-max, 200px);
  aspect-ratio: 5 / 6;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border-top: 6px solid var(--lpc-accent);
  background: var(--lb-ink);
  color: #0d0f1a;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.35);
  min-width: 0;
}
.lpc:not(.lpc--ready):not(.lpc--open) { opacity: 0.9; filter: saturate(0.85); }
.lpc--me { outline: 2px solid var(--lb-accent); outline-offset: 3px; }

.lpc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
.lpc-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  line-height: 1;
}
.lpc-avatar--image { background: #1a2040; }
.lpc-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }

.lpc-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  color: #0d0f1a;
}
.lpc-tag--bot { background: var(--lb-accent-yellow); }
.lpc-tag--me { background: var(--lb-accent); }

.lpc-stamp {
  position: absolute;
  right: 10px;
  top: 42%;
  padding: 2px 7px;
  border: 2px solid oklch(58% 0.19 140);
  border-radius: 4px;
  color: oklch(50% 0.19 140);
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transform: rotate(10deg);
  animation: lpc-stamp 260ms cubic-bezier(0.2, 1.6, 0.4, 1) both;
}
@keyframes lpc-stamp {
  from { transform: rotate(10deg) scale(1.8); opacity: 0; }
  to { transform: rotate(10deg) scale(1); opacity: 1; }
}

.lpc-body { min-width: 0; }
.lpc-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-family: 'Archivo Black', sans-serif;
  font-size: 15px;
  line-height: 1.1;
}
.lpc-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.lpc-status {
  margin-top: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6b6f86;
}
.lpc--ready .lpc-status { color: oklch(50% 0.19 140); }

/* Visible at rest (dimmed) so touch devices without hover can still reach it. */
.lpc-kick {
  position: absolute;
  top: -9px;
  right: -9px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--lb-line-strong);
  background: #1a1f3a;
  color: var(--lb-ink-dim);
  font-size: 16px;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 150ms ease, color 150ms ease, background 150ms ease;
}
.lpc:hover .lpc-kick,
.lpc-kick:focus-visible { opacity: 1; }
.lpc-kick:hover { color: oklch(68% 0.22 25); background: #2a1620; }
.lpc-kick:focus-visible { outline: 2px solid var(--lb-accent); outline-offset: 2px; }

.lpc--open {
  align-items: center;
  justify-content: center;
  text-align: center;
  background: transparent;
  border: 2px dashed var(--lb-line-strong);
  box-shadow: none;
  color: var(--lb-ink-dim);
}
.lpc-open-plus { font-size: 28px; line-height: 1; color: var(--lb-ink-muted); }
.lpc-open-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.lpc-open-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }

@media (prefers-reduced-motion: reduce) {
  .lpc-stamp { animation: none; }
  .lpc-kick { transition: none; }
}
</style>

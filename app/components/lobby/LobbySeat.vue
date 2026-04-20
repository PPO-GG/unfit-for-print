<template>
  <!-- Empty seat -->
  <div
    v-if="!player"
    class="lobby-seat"
    :class="{ 'lobby-seat--clickable': isHostUser }"
    :style="positionStyle"
    @click="isHostUser ? $emit('add-bot') : undefined"
  >
    <div class="lobby-seat-avatar lobby-seat-avatar--empty">+</div>
    <div class="lobby-seat-name" style="color: var(--lb-ink-muted)">OPEN SEAT</div>
    <div class="lobby-seat-status">{{ isHostUser ? "Add bot · Share code" : "Share code" }}</div>
  </div>

  <!-- Filled seat -->
  <div v-else class="lobby-seat" :style="positionStyle">
    <div
      :class="[
        'lobby-seat-avatar',
        player.ready ? 'lobby-seat-avatar--ready' : '',
        player.playerType === 'bot' ? 'lobby-seat-avatar--bot' : '',
        player.isHost ? 'lobby-seat-avatar--host' : '',
        avatarUrl && !imgError ? 'lobby-seat-avatar--image' : '',
      ]"
      :style="avatarUrl && !imgError ? {} : avatarStyle"
    >
      <img
        v-if="avatarUrl && !imgError"
        :src="avatarUrl"
        :alt="player.name"
        class="lobby-seat-avatar-img"
        referrerpolicy="no-referrer"
        @error="imgError = true"
      />
      <span v-else>{{ initials }}</span>
    </div>
    <div class="lobby-seat-name">{{ player.name }}</div>
    <div :class="['lobby-seat-status', statusClass]">{{ statusLabel }}</div>
  </div>
</template>

<script lang="ts" setup>
import type { Player } from "~/types/player";
import { getPlayerAvatarUrl } from "~/composables/usePlayerAvatar";

const props = defineProps<{
  player: Player | null;
  positionStyle: { left: string; top: string };
  isHostUser: boolean;
}>();

const imgError = ref(false);
const avatarUrl = computed(() => getPlayerAvatarUrl(props.player));
watch(avatarUrl, () => { imgError.value = false; });

defineEmits<{
  (e: "add-bot"): void;
  (e: "kick", playerId: string): void;
}>();

const PALETTE = [
  "#5865f2", "#f43f5e", "#22d3ee", "#84cc16",
  "#f59e0b", "#a78bfa", "#fb7185", "#34d399",
];

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const initials = computed(() => {
  if (!props.player) return "";
  if (props.player.playerType === "bot") return "🤖";
  const name = props.player.name?.trim() ?? "";
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
});

const avatarStyle = computed(() => {
  if (!props.player) return {};
  if (props.player.playerType === "bot") {
    return { background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)", color: "#0d0f1a" };
  }
  const color = colorFromId(props.player.userId ?? props.player.$id ?? "");
  return {
    background: `linear-gradient(135deg, ${color}aa 0%, ${color}55 100%)`,
    color: "#0d0f1a",
  };
});

const statusLabel = computed(() => {
  if (!props.player) return "";
  if (props.player.playerType === "bot") return "BOT · auto-ready";
  if (props.player.ready) return "Ready ✓";
  return "Waiting…";
});

const statusClass = computed(() => {
  if (!props.player) return "";
  if (props.player.playerType === "bot") return "lobby-seat-status--bot";
  if (props.player.ready) return "lobby-seat-status--ready";
  return "";
});
</script>

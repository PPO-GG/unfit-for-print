<script lang="ts" setup>
import { useIdle } from "@vueuse/core";

const { t } = useI18n();

defineProps<{
  unreadCount?: number;
}>();

const emit = defineEmits<{
  (e: "toggle-chat"): void;
  (e: "toggle-settings"): void;
  (e: "open-menu"): void;
}>();

// Auto-fade after 5s of inactivity
const { idle } = useIdle(5000);
const hovered = ref(false);
const visible = computed(() => !idle.value || hovered.value);
</script>

<template>
  <div
    class="corner-controls"
    :class="{ 'corner-controls--faded': !visible }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <button
      class="corner-btn"
      :title="t('game.chat', 'Chat (T)')"
      @click="emit('toggle-chat')"
    >
      <UIcon name="i-solar-chat-round-dots-bold-duotone" class="text-base" />
      <span v-if="unreadCount && unreadCount > 0" class="unread-badge">
        {{ unreadCount > 9 ? "9+" : unreadCount }}
      </span>
    </button>

    <button
      class="corner-btn"
      :title="t('game.settings', 'Settings')"
      @click="emit('toggle-settings')"
    >
      <UIcon name="i-solar-settings-bold-duotone" class="text-base" />
    </button>

    <!-- <button
      class="corner-btn"
      :title="t('game.menu_esc', 'Menu (ESC)')"
      @click="emit('open-menu')"
    >
      <span class="text-[11px] font-semibold tracking-wide">ESC</span>
    </button> -->
  </div>
</template>

<style scoped>
.corner-controls {
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 80;
  display: flex;
  gap: 6px;
  transition: opacity 0.4s ease;
}

.corner-controls--faded {
  opacity: 0.25;
}

.corner-controls:hover {
  opacity: 1;
}

.corner-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.35);
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.corner-btn:hover {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.4);
  color: #e2e8f0;
}

.corner-btn--active {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4);
  color: #a78bfa;
}

/* Unread badge */
.corner-btn {
  position: relative;
}

.unread-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  border-radius: 99px;
  background: #8b5cf6;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
  animation: badge-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes badge-pop {
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}
</style>

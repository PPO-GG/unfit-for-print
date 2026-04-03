<script setup lang="ts">
interface Props {
  round: number;
  phase: string;
  myAvatar: string;
}

defineProps<Props>();
const emit = defineEmits<{
  "toggle-sidebar": [];
}>();

const phaseLabels: Record<string, string> = {
  submitting: "Submitting",
  "submitting-complete": "Submitting",
  judging: "Judging",
  roundEnd: "Round Over",
  complete: "Game Over",
};
</script>

<template>
  <div class="mobile-status-bar">
    <!-- Hamburger -->
    <button
      class="hamburger-btn"
      aria-label="Open menu"
      @click="emit('toggle-sidebar')"
    >
      <Icon name="i-solar-hamburger-menu-broken" class="w-6 h-6 text-slate-400" />
    </button>

    <!-- Center: round + phase -->
    <div class="center-info">
      <span class="round-label">Round {{ round }}</span>
      <span class="phase-label">{{ phaseLabels[phase] || phase }}</span>
    </div>

    <!-- User avatar -->
    <div class="avatar-slot">
      <img
        v-if="myAvatar"
        :src="myAvatar"
        alt="You"
        class="w-7 h-7 rounded-full"
      />
      <div v-else class="w-7 h-7 rounded-full bg-slate-700" />
    </div>
  </div>
</template>

<style scoped>
.mobile-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 1rem;
  height: 3rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
}

.hamburger-btn {
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
}

.center-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.round-label {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.03em;
}

.phase-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #94a3b8;
  padding: 0.125rem 0.5rem;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 0.375rem;
}

.avatar-slot {
  width: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

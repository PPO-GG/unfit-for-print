<script setup lang="ts">
import { computed } from "vue";

interface Props {
  phase: string;
  isJudge: boolean;
  selectedCount: number;
  requiredCount: number;
  allRevealed: boolean;
  hasSubmitted: boolean;
  winnerSelected: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  submit: [];
  continue: [];
}>();

type ButtonVariant = "muted" | "green" | "amber" | "purple";

interface ButtonState {
  label: string;
  variant: ButtonVariant;
  disabled: boolean;
  pulse: boolean;
  action: "submit" | "continue" | null;
}

const buttonState = computed<ButtonState>(() => {
  const { phase, isJudge, selectedCount, requiredCount, allRevealed, hasSubmitted, winnerSelected } = props;

  // roundEnd or complete phase
  if (phase === "roundEnd" || phase === "complete") {
    return { label: "Continue", variant: "purple", disabled: false, pulse: false, action: "continue" };
  }

  // submitting phase
  if (phase === "submitting") {
    if (isJudge) {
      return { label: "Waiting for players...", variant: "muted", disabled: true, pulse: true, action: null };
    }
    if (hasSubmitted) {
      return { label: "Waiting for others...", variant: "muted", disabled: true, pulse: true, action: null };
    }
    const remaining = requiredCount - selectedCount;
    if (remaining > 0) {
      const cardWord = remaining === 1 ? "card" : "cards";
      return {
        label: `Select ${remaining} more ${cardWord}`,
        variant: "muted",
        disabled: true,
        pulse: false,
        action: null,
      };
    }
    // selectedCount >= requiredCount
    return { label: "Submit Cards", variant: "green", disabled: false, pulse: false, action: "submit" };
  }

  // judging phase
  if (phase === "judging") {
    if (!isJudge) {
      return { label: "Waiting for judge...", variant: "muted", disabled: true, pulse: true, action: null };
    }
    if (!allRevealed) {
      return { label: "Reveal all cards first", variant: "amber", disabled: true, pulse: false, action: null };
    }
    if (!winnerSelected) {
      return { label: "Pick a winner", variant: "green", disabled: false, pulse: false, action: null };
    }
    return { label: "Winner selected!", variant: "green", disabled: true, pulse: false, action: null };
  }

  // fallback
  return { label: "...", variant: "muted", disabled: true, pulse: false, action: null };
});

function handleClick() {
  if (buttonState.value.disabled) return;
  if (buttonState.value.action === "submit") {
    emit("submit");
  } else if (buttonState.value.action === "continue") {
    emit("continue");
  }
}

const variantClasses: Record<ButtonVariant, string> = {
  muted: "bg-slate-700 text-slate-400",
  green: "bg-emerald-600 text-white hover:bg-emerald-500",
  amber: "bg-yellow-600 text-white",
  purple: "bg-violet-600 text-white hover:bg-violet-500",
};
</script>

<template>
  <div class="mobile-action-bar">
    <div class="fade-overlay" aria-hidden="true" />
    <div class="bar-content">
      <button
        :class="[
          'action-button',
          variantClasses[buttonState.variant],
          buttonState.disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
          buttonState.pulse ? 'animate-pulse' : '',
        ]"
        :disabled="buttonState.disabled"
        type="button"
        @click="handleClick"
      >
        {{ buttonState.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.mobile-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
}

.fade-overlay {
  height: 3rem;
  background: linear-gradient(0deg, #0f172a 0%, transparent 100%);
  pointer-events: none;
}

.bar-content {
  background: #0f172a;
  padding: 0.75rem 1rem;
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}

.action-button {
  display: block;
  width: 100%;
  border-radius: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.875rem 1rem;
  border: none;
  transition: background-color 0.15s ease;
  text-align: center;
}
</style>

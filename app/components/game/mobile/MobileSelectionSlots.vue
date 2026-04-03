<script setup lang="ts">
import { computed } from "vue";

interface Props {
  requiredPicks: number;
  selectedTexts: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  deselect: [index: number];
}>();

const PICK_COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];

const slots = computed(() =>
  Array.from({ length: props.requiredPicks }, (_, i) => ({
    index: i,
    text: props.selectedTexts[i] || null,
    color: PICK_COLORS[i] || PICK_COLORS[0],
    filled: !!props.selectedTexts[i],
  })),
);
</script>

<template>
  <div class="mobile-selection-slots">
    <div
      v-for="slot in slots"
      :key="slot.index"
      :class="['slot', slot.filled ? 'slot--filled' : 'slot--empty']"
      :style="slot.filled ? { borderColor: `${slot.color}80` } : {}"
    >
      <!-- Slot number -->
      <span
        class="slot-number"
        :style="{ backgroundColor: slot.filled ? slot.color : '#334155' }"
      >
        {{ slot.index + 1 }}
      </span>

      <!-- Content -->
      <span v-if="slot.filled" class="slot-text">{{ slot.text }}</span>
      <span v-else class="slot-placeholder">Pick a card...</span>

      <!-- Deselect button -->
      <button
        v-if="slot.filled"
        class="slot-deselect"
        aria-label="Deselect"
        @click.stop="emit('deselect', slot.index)"
      >
        &times;
      </button>
    </div>
  </div>
</template>

<style scoped>
.mobile-selection-slots {
  display: flex;
  gap: 0.5rem;
  padding: 0 0.75rem 0.375rem;
  flex-shrink: 0;
}

.slot {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem;
  border-radius: 0.625rem;
  border: 1.5px dashed #1e293b;
  min-height: 2.5rem;
  position: relative;
}

.slot--filled {
  border-style: solid;
  background: rgba(255, 255, 255, 0.03);
}

.slot-number {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.slot-text {
  color: #e2e8f0;
  font-size: 0.875rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.slot-placeholder {
  color: #475569;
  font-size: 0.875rem;
  font-style: italic;
}

.slot-deselect {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 50%;
  background: #334155;
  color: #94a3b8;
  font-size: 0.75rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
}
</style>

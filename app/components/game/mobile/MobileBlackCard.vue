<script setup lang="ts">
import { computed } from "vue";

interface Props {
  text: string;
  pick: number;
  selectedTexts: string[];
  playersWaiting: number;
}

const props = defineProps<Props>();

const FILL_COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];

/**
 * Split the black card text into segments of plain text and blanks.
 * Blanks are `_` characters in the original text.
 */
const segments = computed(() => {
  const parts: Array<
    { type: "text"; value: string } | { type: "blank"; index: number }
  > = [];
  let blankIndex = 0;
  const chunks = props.text.split("_");

  chunks.forEach((chunk, i) => {
    if (chunk) {
      parts.push({ type: "text", value: chunk });
    }
    if (i < chunks.length - 1) {
      parts.push({ type: "blank", index: blankIndex++ });
    }
  });

  return parts;
});

const hasBlanks = computed(() =>
  segments.value.some((s) => s.type === "blank"),
);
</script>

<template>
  <div class="mobile-black-card">
    <div class="card">
      <!-- PICK badge -->
      <div v-if="pick > 1" class="pick-badge">PICK {{ pick }}</div>

      <!-- Card text with fill-in preview -->
      <p class="card-text">
        <template v-if="hasBlanks">
          <template v-for="(seg, i) in segments" :key="i">
            <template v-if="seg.type === 'text'">{{ seg.value }}</template>
            <span
              v-else-if="seg.type === 'blank' && selectedTexts[seg.index]"
              class="mobile-black-card__fill"
              :style="{ color: FILL_COLORS[seg.index] || FILL_COLORS[0] }"
            >{{ selectedTexts[seg.index] }}</span>
            <span
              v-else-if="seg.type === 'blank'"
              class="mobile-black-card__blank"
            />
          </template>
        </template>
        <template v-else>{{ text }}</template>
      </p>

      <!-- Players waiting -->
      <p v-if="playersWaiting > 0" class="waiting-text">
        {{ playersWaiting }} player{{ playersWaiting > 1 ? "s" : "" }} waiting
      </p>
    </div>
  </div>
</template>

<style scoped>
.mobile-black-card {
  padding: 0.5rem 0.75rem 0.375rem;
  flex-shrink: 0;
}

.card {
  background: #1c2342;
  border-radius: 0.75rem;
  padding: 0.75rem 0.875rem;
  outline: 5px solid rgba(42, 52, 99, 0.35);
  outline-offset: -5px;
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.35),
    inset 0 0 80px rgba(0, 0, 0, 0.2);
  position: relative;
}

.pick-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.625rem;
  background: rgba(255, 255, 255, 0.12);
  color: white;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  letter-spacing: 0.05em;
}

.card-text {
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.35;
  margin: 0;
}

.mobile-black-card__blank {
  display: inline-block;
  width: 4rem;
  height: 1em;
  vertical-align: middle;
  background: rgba(100, 116, 139, 0.5);
  border-radius: 0.125rem;
  outline: 1px dashed rgba(255, 255, 255, 0.25);
  border-bottom: 1px solid rgba(255, 255, 255, 0.25);
  margin: 0 0.25rem;
}

.mobile-black-card__fill {
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
}

.waiting-text {
  color: #64748b;
  font-size: 0.6875rem;
  margin: 0.5rem 0 0;
}
</style>

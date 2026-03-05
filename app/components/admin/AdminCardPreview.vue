<template>
  <div
    class="admin-card-preview group relative select-none"
    :class="[isBlack ? 'card--black' : 'card--white']"
    @click="$emit('click')"
  >
    <!-- Active status badge -->
    <div class="absolute top-1.5 right-1.5 z-20">
      <span
        class="inline-block w-2 h-2 rounded-full"
        :class="
          active
            ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]'
            : 'bg-red-500/60'
        "
      />
    </div>

    <!-- Card face -->
    <div class="card-face">
      <!-- Formatted text: replace _ placeholders for black cards -->
      <p class="card-text" v-html="formattedText" />

      <!-- Pick badge for black cards -->
      <span v-if="isBlack && pick && pick > 1" class="pick-badge">
        <UIcon name="i-solar-cards-bold-duotone" class="mr-0.5" />
        {{ pick }}
      </span>
    </div>

    <!-- Hover action overlay -->
    <div class="action-overlay">
      <slot name="actions" />
    </div>

    <!-- Bottom metadata strip -->
    <div class="meta-strip">
      <span class="meta-pack truncate max-w-[80%]">{{ pack }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  text: string;
  pack: string;
  active?: boolean;
  type: "white" | "black";
  pick?: number;
}>();

defineEmits(["click"]);

const isBlack = computed(() => props.type === "black");

const formattedText = computed(() => {
  if (!isBlack.value) return props.text;
  // Replace underscores with blank fill lines (matching the real BlackCard component)
  return props.text.replace(/_/g, '<span class="blank-fill"></span>');
});
</script>

<style scoped>
.admin-card-preview {
  aspect-ratio: 3 / 4;
  border-radius: 10px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  transition:
    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.18s ease;
  width: 100%;
}

.admin-card-preview:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  z-index: 10;
}

/* ── Black card ── */
.card--black {
  background-color: #1c2342;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ── White card ── */
.card--white {
  background-color: #e7e1de;
  color: #111;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

/* Inner inset border matching game cards */
.card--black::before,
.card--white::before {
  content: "";
  position: absolute;
  inset: 5px;
  border-radius: 7px;
  pointer-events: none;
  z-index: 1;
}

.card--black::before {
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.3);
}

.card--white::before {
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.15);
}

/* ── Card face ── */
.card-face {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 10px 24px;
  position: relative;
  z-index: 2;
}

.card-text {
  font-size: clamp(0.55rem, 2.8cqi, 1.3rem);
  line-height: 1.3;
  text-align: center;
  font-weight: 600;
  word-break: break-word;
  hyphens: auto;
}

/* Blank underscore fill — inline element that mimics the fill line */
:global(.blank-fill) {
  display: inline-block;
  width: 2.5em;
  height: 0.85em;
  vertical-align: middle;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  border-bottom: 1.5px solid rgba(255, 255, 255, 0.35);
  margin: 0 2px;
}

/* Pick badge bottom-right */
.pick-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.45);
  z-index: 3;
}

/* ── Hover action overlay ── */
.action-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.18s ease;
  z-index: 15;
  border-radius: 10px;
}

.admin-card-preview:hover .action-overlay {
  opacity: 1;
}

/* ── Bottom metadata strip ── */
.meta-strip {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 3px 8px;
  display: flex;
  align-items: center;
  z-index: 4;
  pointer-events: none;
}

.card--black .meta-strip {
  background: linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 100%);
}

.card--white .meta-strip {
  background: linear-gradient(to top, rgba(0, 0, 0, 0.15) 0%, transparent 100%);
}

.meta-pack {
  font-size: 0.5rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.55;
}

.card--black .meta-pack {
  color: white;
}

.card--white .meta-pack {
  color: #111;
}
</style>

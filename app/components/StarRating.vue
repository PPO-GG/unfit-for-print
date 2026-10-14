<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="star-rating"
    @mouseleave="hover = null"
  >
    <button
      v-for="star in 5"
      :key="star"
      type="button"
      role="radio"
      class="star-rating__star"
      :class="{ 'is-on': star <= (hover ?? modelValue ?? 0) }"
      :aria-checked="modelValue === star"
      :aria-label="t('feedback.star_label', { n: star })"
      :tabindex="(modelValue ?? 1) === star ? 0 : -1"
      :data-testid="`star-${star}`"
      @mouseenter="hover = star"
      @click="select(star)"
      @keydown="onKey($event, star)"
    >
      ★
    </button>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";

defineProps<{ modelValue: number | null; label: string }>();
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const { t } = useI18n();
const hover = ref<number | null>(null);

function select(star: number) {
  emit("update:modelValue", star);
}

/** Radio-group keys: arrows move and select, clamped to 1–5, and focus
 *  follows so a keyboard player can see where they are. */
function onKey(e: KeyboardEvent, star: number) {
  const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1
    : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1
    : 0;
  if (step === 0) return;
  e.preventDefault();
  const next = Math.min(5, Math.max(1, star + step));
  select(next);
  const group = (e.currentTarget as HTMLElement).parentElement;
  (group?.children[next - 1] as HTMLElement | undefined)?.focus();
}
</script>

<style scoped>
.star-rating {
  display: inline-flex;
  gap: 0.25rem;
}
.star-rating__star {
  font-size: 1.75rem;
  line-height: 1;
  padding: 0.125rem;
  color: rgb(100 116 139); /* slate-500 */
  transition: color 120ms ease, transform 120ms ease;
}
.star-rating__star.is-on {
  color: rgb(251 191 36); /* amber-400 */
}
.star-rating__star:hover {
  transform: scale(1.12);
}
.star-rating__star:focus-visible {
  outline: 2px solid rgb(251 191 36);
  outline-offset: 2px;
  border-radius: 0.25rem;
}
@media (prefers-reduced-motion: reduce) {
  .star-rating__star { transition: none; }
  .star-rating__star:hover { transform: none; }
}
</style>

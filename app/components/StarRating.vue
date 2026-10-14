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
      :class="{ 'is-on': star <= (hover ?? focused ?? modelValue ?? 0) }"
      :aria-checked="modelValue === star"
      :aria-label="t('feedback.star_label', { n: star })"
      :tabindex="(focused ?? modelValue ?? 1) === star ? 0 : -1"
      :data-testid="`star-${star}`"
      @mouseenter="hover = star"
      @focus="onFocus(star)"
      @blur="onBlur"
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
/** The star keyboard focus is on. Arrows move it and preview the
 *  highlight; only a click commits — and a native button turns Enter and
 *  Space into a click, so nothing here handles those keys. */
const focused = ref<number | null>(null);

function select(star: number) {
  // A touch tap fires mouseenter with no mouseleave; don't leave it lit.
  hover.value = null;
  emit("update:modelValue", star);
}

function onFocus(star: number) {
  focused.value = star;
  hover.value = null;
}

function onBlur() {
  focused.value = null;
  hover.value = null;
}

/** Radio-group keys move focus (clamped to 1–5) without choosing, so a
 *  keyboard player can reach every star before committing to one. */
function onKey(e: KeyboardEvent, star: number) {
  let next: number;
  if (e.key === "ArrowRight" || e.key === "ArrowUp") next = star + 1;
  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = star - 1;
  else if (e.key === "Home") next = 1;
  else if (e.key === "End") next = 5;
  else return;
  e.preventDefault();
  next = Math.min(5, Math.max(1, next));
  focused.value = next;
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

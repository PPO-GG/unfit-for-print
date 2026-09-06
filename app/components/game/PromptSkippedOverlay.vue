<script lang="ts" setup>
import { ref, watch } from "vue";
import { gsap } from "gsap";

const props = defineProps<{
  /** Bumped whenever a prompt is skipped. Undefined on legacy docs. */
  trigger?: number;
}>();

const { t } = useI18n();

const visible = ref(false);
const headlineRef = ref<HTMLElement | null>(null);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.trigger,
  (next, prev) => {
    // Only a genuine change counts — not a doc gaining the key for the
    // first time, which is what an undefined `prev` means.
    if (next === undefined || prev === undefined || next === prev) return;

    visible.value = true;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (visible.value = false), 1500);

    requestAnimationFrame(() => {
      if (!headlineRef.value) return;
      gsap.fromTo(
        headlineRef.value,
        { scale: 0.7, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.7)" },
      );
    });
  },
);

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<template>
  <Transition name="prompt-skipped">
    <div v-if="visible" class="prompt-skipped-overlay">
      <h2 ref="headlineRef" class="prompt-skipped-headline">
        {{ t("game.prompt_skipped") }}
      </h2>
    </div>
  </Transition>
</template>

<style scoped>
.prompt-skipped-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.prompt-skipped-headline {
  /* amber-500 — the same accent the judging seat ring pulses. */
  color: rgb(245 158 11);
  font-weight: 900;
  font-size: clamp(2rem, 9vw, 5rem);
  letter-spacing: 0.08em;
  text-align: center;
  text-shadow: 0 0 24px rgba(245, 158, 11, 0.45);
}

.prompt-skipped-enter-active,
.prompt-skipped-leave-active {
  transition: opacity 0.25s ease;
}
.prompt-skipped-enter-from,
.prompt-skipped-leave-to {
  opacity: 0;
}
</style>

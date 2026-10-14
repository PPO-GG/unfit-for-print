<template>
  <Transition name="fbp">
    <aside
      v-if="stage !== 'hidden'"
      class="fbp"
      :class="{ 'fbp--compact': isCompact }"
      aria-live="polite"
      data-testid="feedback-prompt"
    >
      <button
        type="button"
        class="fbp-close"
        :aria-label="t('feedback.close')"
        data-testid="feedback-prompt-close"
        @click="stage === 'ask' ? dismiss() : done()"
      >
        ✕
      </button>

      <template v-if="stage === 'ask'">
        <p class="fbp-text">{{ t("feedback.prompt_question") }}</p>
        <StarRating
          :model-value="null"
          :label="t('feedback.prompt_question')"
          @update:model-value="rate"
        />
      </template>

      <template v-else>
        <p class="fbp-text">{{ t("feedback.prompt_thanks") }}</p>
        <div class="fbp-actions">
          <button type="button" class="fbp-btn fbp-btn--primary" data-testid="feedback-prompt-more" @click="tellMore">
            {{ t("feedback.prompt_more") }}
          </button>
          <button type="button" class="fbp-btn" data-testid="feedback-prompt-done" @click="done">
            {{ t("feedback.prompt_done") }}
          </button>
        </div>
      </template>
    </aside>
  </Transition>
</template>

<script lang="ts" setup>
import { watch } from "vue";
import StarRating from "~/components/StarRating.vue";
import { useCompactLayout } from "~/composables/useCompactLayout";
import { useFeedbackPrompt } from "~/composables/useFeedbackPrompt";

const { t } = useI18n();
const route = useRoute();
const { isCompact } = useCompactLayout();
const { stage, rate, dismiss, done, tellMore, hide } = useFeedbackPrompt();

// The podium → lobby auto-return stays on /game/[code], so the card rides
// through it. Leaving the game drops it without counting as a dismissal.
watch(
  () => route.path,
  (path) => {
    if (!path.startsWith("/game/")) hide();
  },
);
</script>

<style scoped>
.fbp {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 40; /* above the table, below UModal and toasts */
  width: min(20rem, calc(100vw - 2rem));
  padding: 1rem 2.25rem 1rem 1rem;
  border-radius: 1rem;
  background: rgb(15 23 42 / 0.94); /* slate-900 */
  border: 1px solid rgb(51 65 85); /* slate-700 */
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.45);
  backdrop-filter: blur(8px);
  color: rgb(226 232 240); /* slate-200 */
}
/* Phones: pinned to the top so it never covers GameOver's bottom
   "Continue to lobby" button. */
.fbp--compact {
  right: 0.75rem;
  left: 0.75rem;
  bottom: auto;
  top: calc(env(safe-area-inset-top) + 0.75rem);
  width: auto;
}
.fbp-text {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.fbp-close {
  position: absolute;
  top: 0.5rem;
  right: 0.625rem;
  padding: 0.25rem;
  color: rgb(148 163 184); /* slate-400 */
}
.fbp-close:hover { color: rgb(241 245 249); }
.fbp-actions { display: flex; gap: 0.5rem; }
.fbp-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  background: rgb(30 41 59); /* slate-800 */
}
.fbp-btn--primary {
  background: rgb(var(--ui-primary-rgb, 245 158 11) / 0.25);
  color: rgb(253 230 138); /* amber-200 */
}
.fbp-enter-active, .fbp-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
.fbp-enter-from, .fbp-leave-to { opacity: 0; transform: translateY(0.75rem); }
.fbp--compact.fbp-enter-from, .fbp--compact.fbp-leave-to { transform: translateY(-0.75rem); }
@media (prefers-reduced-motion: reduce) {
  .fbp-enter-active, .fbp-leave-active { transition: opacity 120ms linear; }
  .fbp-enter-from, .fbp-leave-to { transform: none; }
}
</style>

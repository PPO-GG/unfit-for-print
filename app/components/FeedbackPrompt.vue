<template>
  <Transition name="fbp">
    <aside
      v-if="stage !== 'hidden'"
      class="fbp"
      :class="{ 'fbp--compact': isCompact }"
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
          <button
            ref="moreButton"
            type="button"
            class="fbp-btn fbp-btn--primary"
            data-testid="feedback-prompt-more"
            @click="tellMore"
          >
            {{ t("feedback.prompt_more") }}
          </button>
          <button type="button" class="fbp-btn" data-testid="feedback-prompt-done" @click="done">
            {{ t("feedback.prompt_done") }}
          </button>
        </div>
      </template>
    </aside>
  </Transition>
  <!-- Always rendered, so the region exists before its text changes: a live
       region inserted together with its content is often not announced. -->
  <p class="sr-only" aria-live="polite" data-testid="feedback-prompt-live">{{ announcement }}</p>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";
import StarRating from "~/components/StarRating.vue";
import { useCompactLayout } from "~/composables/useCompactLayout";
import { useFeedbackPrompt } from "~/composables/useFeedbackPrompt";

const { t } = useI18n();
const route = useRoute();
const { isCompact } = useCompactLayout();
const { stage, rate, dismiss, done, tellMore, hide } = useFeedbackPrompt();
const moreButton = ref<HTMLButtonElement | null>(null);

const announcement = computed(() =>
  stage.value === "ask" ? t("feedback.prompt_question") : "",
);

// Rating unmounts the stars, which held focus. Hand it to the next action —
// a response to the player's own choice, so not focus-stealing.
watch(stage, async (next, prev) => {
  if (prev !== "ask" || next !== "thanks") return;
  await nextTick();
  moreButton.value?.focus();
});

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
/* Desktop: bottom-right, raised clear of the controls that live there.
   From the viewport floor up, the lobby stacks LobbyStartBar (14px margin +
   ~59px bar = 73px), the main area's 12px padding, then the house-rules
   panel's 1px border + 16px padding, its ~14px shuffle hint, a 12px gap and
   the host's ~43px Shuffle button — whose top lands near 171px. 12rem
   (192px) clears that with room for its 1px hover lift and 4px shadow, and
   sits far above GameOver's "Continue to lobby" (24px padding + 48px button
   + 4px shadow = 76px) and its timer line (to ~96px). */
.fbp {
  position: fixed;
  right: 1.5rem;
  bottom: calc(var(--safe-bottom) + 12rem);
  z-index: 40; /* above the table, below UModal and toasts */
  width: min(20rem, calc(100vw - 2rem));
  padding: 1rem 2.75rem 1rem 1rem;
  border-radius: 1rem;
  background: rgb(15 23 42 / 0.94); /* slate-900 */
  border: 1px solid rgb(51 65 85); /* slate-700 */
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.45);
  backdrop-filter: blur(8px);
  color: rgb(226 232 240); /* slate-200 */
  /* The body font is Bebas Neue, an all-caps display face that turns a
     sentence at this size into a squint. A question meant to be read at a
     glance gets the readable body face instead. */
  font-family: var(--font-body);
}
/* Phones: pinned to the top so it never covers GameOver's bottom
   "Continue to lobby" button. */
.fbp--compact {
  right: 0.75rem;
  left: 0.75rem;
  bottom: auto;
  top: calc(var(--safe-top) + 0.75rem);
  width: auto;
}
.fbp-text {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.35;
  margin-bottom: 0.5rem;
}
.fbp-close {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: grid;
  place-items: center;
  min-width: 2.5rem;
  min-height: 2.5rem;
  border-radius: 0.5rem;
  color: rgb(148 163 184); /* slate-400 */
}
.fbp-close:hover { color: rgb(241 245 249); }
.fbp-close:focus-visible,
.fbp-btn:focus-visible {
  outline: 2px solid rgb(251 191 36); /* amber-400, as the stars */
  outline-offset: 2px;
}
.fbp-actions { display: flex; gap: 0.5rem; }
.fbp-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
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

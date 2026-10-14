<template>
  <ClientOnly>
    <UModal v-model:open="isOpen" :title="t('feedback.title', 'Send feedback')">
      <template #body>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-2" role="group" :aria-label="t('feedback.title', 'Send feedback')">
            <button
              v-for="m in modes"
              :key="m.value"
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              :class="
                mode === m.value
                  ? 'bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/50'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              "
              :aria-pressed="mode === m.value"
              :data-testid="`mode-${m.value}`"
              @click="mode = m.value"
            >
              {{ m.icon }} {{ m.label }}
            </button>
          </div>

          <!-- Broken: the old Report-a-Problem form, behaviour unchanged. -->
          <template v-if="mode === 'broken'">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{
                t(
                  "report.blurb",
                  "Tell us what went wrong. We attach what the game was doing automatically, so you don't have to describe it.",
                )
              }}
            </p>
            <USelect v-model="category" :items="categoryItems" value-key="value" class="w-full" />
            <UTextarea
              v-model="message"
              :maxlength="REPORT_MAX"
              :rows="4"
              :placeholder="t('report.placeholder', 'What happened?')"
              class="w-full"
            />
            <p
              class="text-xs text-right"
              :class="REPORT_MAX - message.length < 50 ? 'text-amber-500' : 'text-gray-500 dark:text-gray-400'"
            >
              {{ message.length }} / {{ REPORT_MAX }}
            </p>
          </template>

          <!-- Idea: stars and/or text, optional topics. -->
          <template v-else>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t("feedback.idea_blurb", "What's working, what isn't, what you wish it did. We read every one.") }}
            </p>
            <div>
              <p class="text-sm mb-1">{{ ratingLabel }}</p>
              <StarRating v-model="rating" :label="ratingLabel" />
            </div>
            <div>
              <p class="text-sm mb-2">{{ t("feedback.topics_label", "What's it about? (optional)") }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="topic in FEEDBACK_TOPICS"
                  :key="topic"
                  type="button"
                  class="rounded-full px-3 py-1 text-xs transition-colors"
                  :class="
                    topics.includes(topic)
                      ? 'bg-primary-500/25 text-primary-200 ring-1 ring-primary-500/50'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  "
                  :aria-pressed="topics.includes(topic)"
                  :data-testid="`topic-${topic}`"
                  @click="toggleTopic(topic)"
                >
                  {{ t(`feedback.topic_${topic}`) }}
                </button>
              </div>
            </div>
            <UTextarea
              v-model="ideaMessage"
              :maxlength="FEEDBACK_MESSAGE_MAX"
              :rows="4"
              :placeholder="t('feedback.idea_placeholder', 'Tell us anything…')"
              class="w-full"
            />
            <p
              class="text-xs text-right"
              :class="FEEDBACK_MESSAGE_MAX - ideaMessage.length < 50 ? 'text-amber-500' : 'text-gray-500 dark:text-gray-400'"
            >
              {{ ideaMessage.length }} / {{ FEEDBACK_MESSAGE_MAX }}
            </p>
          </template>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="soft" class="p-3" @click="close">
            {{ t("report.cancel", "Cancel") }}
          </UButton>
          <UButton
            v-if="mode === 'broken'"
            data-testid="report-submit"
            color="primary"
            variant="soft"
            class="p-3"
            :disabled="!canSubmitReport"
            @click="submitReport"
          >
            {{ t("report.submit", "Send Report") }}
          </UButton>
          <UButton
            v-else
            data-testid="idea-submit"
            color="primary"
            variant="soft"
            class="p-3"
            :disabled="!canSubmitIdea"
            @click="submitIdea"
          >
            {{ t("feedback.submit", "Send feedback") }}
          </UButton>
        </div>
      </template>
    </UModal>
  </ClientOnly>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { FEEDBACK_MESSAGE_MAX, FEEDBACK_TOPICS, type FeedbackTopic } from "#shared/feedback";
import { useFeedbackModal, type FeedbackMode } from "~/composables/useFeedbackModal";
import { useFeedbackSender } from "~/composables/useFeedbackSender";
import { useIssueReporter } from "~/composables/useIssueReporter";
import { useNotifications } from "~/composables/useNotifications";
import { makeClientRef } from "~/utils/clientRef";
import StarRating from "~/components/StarRating.vue";

/** Matches MESSAGE_MAX in server/utils/issueConstants.ts. */
const REPORT_MAX = 500;

const { t } = useI18n();
const { isOpen, options, close } = useFeedbackModal();
const { report } = useIssueReporter();
const { send } = useFeedbackSender();
const { notify } = useNotifications();

const mode = ref<FeedbackMode>("idea");

// Broken mode
const category = ref("stuck");
const message = ref("");
const canSubmitReport = computed(() => message.value.trim().length > 0);

/** No option may carry an empty-string value — Reka UI's Select primitive
 *  throws on one, because it reserves "" for clearing the selection. */
const categoryItems = computed(() => [
  { label: t("report.cat_stuck", "The game is stuck"), value: "stuck" },
  { label: t("report.cat_visual", "Something looks wrong"), value: "visual" },
  { label: t("report.cat_audio", "Sound or voice problem"), value: "audio" },
  { label: t("report.cat_cards", "A card is broken"), value: "cards" },
  { label: t("report.cat_other", "Something else"), value: "other" },
]);

// Idea mode
const rating = ref<number | null>(null);
const topics = ref<FeedbackTopic[]>([]);
const ideaMessage = ref("");
const clientRef = ref("");
const canSubmitIdea = computed(() => rating.value !== null || ideaMessage.value.trim().length > 0);
const ratingLabel = computed(() => t("feedback.rating_label", "How're you liking Unfit for Print so far?"));

const modes = computed(() => [
  { value: "broken" as const, icon: "🐛", label: t("feedback.mode_broken", "Something's broken") },
  { value: "idea" as const, icon: "💡", label: t("feedback.mode_idea", "Share an idea or opinion") },
]);

// Every open starts from what the opener asked for: the prompt card passes
// its rating and clientRef so the follow-up enriches the same row.
watch(
  isOpen,
  (open) => {
    if (!open) return;
    mode.value = options.value.mode;
    rating.value = options.value.rating;
    topics.value = [];
    ideaMessage.value = "";
    clientRef.value = options.value.clientRef ?? makeClientRef();
  },
  { immediate: true },
);

function toggleTopic(topic: FeedbackTopic) {
  topics.value = topics.value.includes(topic)
    ? topics.value.filter((x) => x !== topic)
    : [...topics.value, topic];
}

function submitReport() {
  // The button is disabled in this state; this is the guard behind it.
  if (!canSubmitReport.value) return;
  // `report` is fire-and-forget and never throws — see useIssueReporter. The
  // game state travels with it automatically via the context provider.
  report({
    kind: "player-report",
    message: message.value.trim().slice(0, REPORT_MAX),
    context: { category: category.value },
  });
  notify({
    title: t("report.sent_title", "Report sent"),
    description: t("report.sent_body", "Thanks — we'll take a look."),
    color: "success",
  });
  message.value = "";
  category.value = "stuck";
  close();
}

function submitIdea() {
  if (!canSubmitIdea.value) return;
  const text = ideaMessage.value.trim().slice(0, FEEDBACK_MESSAGE_MAX);
  send({
    clientRef: clientRef.value,
    rating: rating.value,
    topics: topics.value,
    message: text || null,
    source: options.value.source,
    lobbyCode: options.value.lobbyCode,
  });
  notify({
    title: t("feedback.sent_title", "Thanks!"),
    description: t("feedback.sent_body", "Thanks — we read every one."),
    color: "success",
  });
  ideaMessage.value = "";
  topics.value = [];
  rating.value = null;
  close();
}
</script>

<template>
  <ClientOnly>
    <!-- v-model:open rather than ConfirmDialog's :open + @update:open pair:
         that component needs the handler to resolve its promise on dismiss,
         this one has nothing to do but flip the flag. -->
    <UModal
      v-model:open="isOpen"
      :title="t('report.title', 'Report a Problem')"
    >
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{
              t(
                "report.blurb",
                "Tell us what went wrong. We attach what the game was doing automatically, so you don't have to describe it.",
              )
            }}
          </p>

          <USelect
            v-model="category"
            :items="categoryItems"
            value-key="value"
            class="w-full"
          />

          <UTextarea
            v-model="message"
            :maxlength="MESSAGE_MAX"
            :rows="4"
            :placeholder="t('report.placeholder', 'What happened?')"
            class="w-full"
          />

          <p
            class="text-xs text-right"
            :class="
              remaining < 50
                ? 'text-amber-500'
                : 'text-gray-500 dark:text-gray-400'
            "
          >
            {{ message.length }} / {{ MESSAGE_MAX }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="soft" class="p-3" @click="close">
            {{ t("report.cancel", "Cancel") }}
          </UButton>
          <UButton
            data-testid="report-submit"
            color="primary"
            variant="soft"
            class="p-3"
            :disabled="!canSubmit"
            @click="submit"
          >
            {{ t("report.submit", "Send Report") }}
          </UButton>
        </div>
      </template>
    </UModal>
  </ClientOnly>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { useIssueReporter } from "~/composables/useIssueReporter";
import { useNotifications } from "~/composables/useNotifications";
import { useReportProblem } from "~/composables/useReportProblem";

/** Matches MESSAGE_MAX in server/utils/issueConstants.ts. The server truncates
 *  too, but silently clipping someone's report is a worse experience than
 *  never letting them overrun in the first place. */
const MESSAGE_MAX = 500;

const { t } = useI18n();
const { isOpen, close } = useReportProblem();
const { report } = useIssueReporter();
const { notify } = useNotifications();

const category = ref("stuck");
const message = ref("");

const remaining = computed(() => MESSAGE_MAX - message.value.length);
const canSubmit = computed(() => message.value.trim().length > 0);

/** No option may carry an empty-string value — Reka UI's Select primitive
 *  throws on one, because it reserves "" for clearing the selection. */
const categoryItems = computed(() => [
  { label: t("report.cat_stuck", "The game is stuck"), value: "stuck" },
  { label: t("report.cat_visual", "Something looks wrong"), value: "visual" },
  { label: t("report.cat_audio", "Sound or voice problem"), value: "audio" },
  { label: t("report.cat_cards", "A card is broken"), value: "cards" },
  { label: t("report.cat_other", "Something else"), value: "other" },
]);

function submit() {
  // The button is disabled in this state; this is the guard behind it.
  if (!canSubmit.value) return;

  // `report` is fire-and-forget and never throws — see useIssueReporter. The
  // game state travels with it automatically via the context provider, which
  // is why this form asks for so little.
  report({
    kind: "player-report",
    message: message.value.trim().slice(0, MESSAGE_MAX),
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
</script>

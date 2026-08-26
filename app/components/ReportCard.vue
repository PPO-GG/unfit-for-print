<script lang="ts" setup>
import { useUserStore } from "~/stores/userStore";

interface ReportReason {
  label: string;
  description: string;
  id: string;
}

const props = defineProps<{
  cardId: string;
  cardType: "white" | "black";
}>();

const emit = defineEmits(["submit", "cancel"]);
const userStore = useUserStore();
const otherReason = ref("");
const isSubmitting = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

// Define the radio group options as simple strings
const items = ref<ReportReason[]>([
  {
    label: "Spelling",
    description: "Incorrect spelling or grammar",
    id: "Spelling",
  },
  {
    label: "Duplicate",
    description: "This card is a duplicate of another",
    id: "Duplicate",
  },
  {
    label: "Inappropriate",
    description: "Content is (too) inappropriate for the game",
    id: "Inappropriate",
  },
  {
    label: "Other",
    description: "Other reason (please specify)",
    id: "Other",
  },
]);
const selectedReason = ref<string>("Spelling");
const { $activityFetch } = useNuxtApp();

// Emit the selected reason when the user submits the report
const handleSubmit = async () => {
  if (!userStore.isLoggedIn) {
    errorMessage.value = "You must be logged in to report a card";
    return;
  }

  if (!selectedReason.value) {
    errorMessage.value = "Please select a reason for reporting";
    return;
  }

  if (selectedReason.value === "Other" && !otherReason.value.trim()) {
    errorMessage.value = "Please provide details for your report";
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = "";

  try {
    const reason =
      selectedReason.value === "Other"
        ? otherReason.value
        : items.value.find((item) => item.id === selectedReason.value)
            ?.description || selectedReason.value;

    await $activityFetch("/api/reports/create", {
      method: "POST",
      body: {
        cardId: props.cardId,
        cardType: props.cardType,
        reason,
      },
    });

    successMessage.value = "Report submitted successfully";
    setTimeout(() => {
      emit("submit", selectedReason.value);
    }, 1500);
  } catch (error) {
    console.error("Error submitting report:", error);
    errorMessage.value = "Failed to submit report. Please try again.";
  } finally {
    isSubmitting.value = false;
  }
};

const maxLength = 255;
</script>

<template>
  <div class="p-4">
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      class="mb-4"
      :title="errorMessage"
    />

    <UAlert
      v-if="successMessage"
      color="success"
      variant="soft"
      icon="i-heroicons-check-circle"
      class="mb-4"
      :title="successMessage"
    />

    <URadioGroup
      v-model="selectedReason"
      :items="items"
      default-value="Spelling"
      value-key="id"
    />

    <UTextarea
      v-if="selectedReason === 'Other'"
      v-model="otherReason"
      :maxlength="maxLength"
      :ui="{ trailing: 'pointer-events-none' }"
      aria-describedby="character-count"
      class="mt-2 w-full"
      autoresize
      placeholder="Please specify the reason"
    >
      <template #trailing>
        <div
          id="character-count"
          aria-live="polite"
          class="text-xs text-muted tabular-nums mt-4"
          role="status"
        >
          {{ otherReason.length }}/{{ maxLength }}
        </div>
      </template>
    </UTextarea>

    <UFieldGroup class="flex justify-start mt-4">
      <UButton
        color="primary"
        @click="handleSubmit"
        :loading="isSubmitting"
        :disabled="isSubmitting || !!successMessage"
      >
        Submit Report
      </UButton>
      <UButton
        color="secondary"
        @click="$emit('cancel')"
        :disabled="isSubmitting"
      >
        Cancel
      </UButton>
    </UFieldGroup>
  </div>
</template>

<style scoped></style>

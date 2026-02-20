<template>
  <div class="mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md">
    <UAlert v-if="!isLoggedIn" color="warning" class="mb-4">
      <template #title>Login Required</template>
      <template #description>
        You need to be logged in to submit cards. Please log in to continue.
      </template>
    </UAlert>

    <form v-if="isLoggedIn" @submit.prevent="submitCard" class="space-y-6">
      <h1 class="text-3xl font-bold mb-8">Card Submissions</h1>
      <!-- Card Type Selection -->
      <div>
        <ClientOnly>
          <UFieldGroup v-model="cardType" class="w-full">
            <UButton
              value="white"
              color="secondary"
              variant="soft"
              :class="cardType === 'white' ? 'ring-2 ring-gray-200' : ''"
              class="flex-1"
              @click="cardType = 'white'"
            >
              White Card
            </UButton>
            <UButton
              value="black"
              color="secondary"
              variant="soft"
              :class="cardType === 'black' ? 'ring-2 ring-gray-700' : ''"
              class="flex-1"
              @click="cardType = 'black'"
            >
              Black Card
            </UButton>
          </UFieldGroup>
        </ClientOnly>
        <p v-if="cardType === 'black'" class="mt-2 text-sm text-gray-500">
          Use underscores (_) to indicate blank spaces where white cards will be
          placed.
        </p>
      </div>

      <!-- Card Text Input -->
      <ClientOnly>
        <UForm label="Card Text" name="cardText" :state="{ cardText }">
          <UTextarea
            v-model="cardText"
            :placeholder="
              cardType === 'white'
                ? 'Enter your white card text...'
                : 'Enter your black card text with _ for blanks...'
            "
            :maxlength="200"
            :rows="3"
            class="w-full"
            :disabled="submitting || !isLoggedIn"
          />
          <template #hint>
            <div class="flex justify-between">
              <span>{{ cardText.length }}/200 characters</span>
              <span v-if="cardType === 'black'">
                Picks: {{ calculatePicks }}
              </span>
            </div>
          </template>
        </UForm>
      </ClientOnly>

      <!-- Card Preview -->
      <div class="mt-6">
        <h3 class="text-lg font-medium mb-4">Preview</h3>
        <ClientOnly>
          <div class="flex justify-center">
            <div v-if="cardType === 'white'" class="w-64">
              <WhiteCard :text="cardText.trim()" :threeDeffect="true" />
            </div>
            <div v-else class="w-64">
              <BlackCard
                :text="cardText.trim()"
                :numPick="calculatePicks"
                :threeDeffect="true"
              />
            </div>
          </div>
        </ClientOnly>
      </div>

      <!-- Submit Button -->
      <div class="flex justify-end">
        <ClientOnly>
          <UButton
            type="submit"
            color="primary"
            :loading="submitting"
            :disabled="!isValidSubmission || submitting || !isLoggedIn"
          >
            Submit Card
          </UButton>
        </ClientOnly>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from "~/stores/userStore";
import { isAuthenticatedUser } from "~/composables/useUserUtils";

const { sanitize } = useSanitize();
// User authentication
const userStore = useUserStore();
const isLoggedIn = computed(() => isAuthenticatedUser(userStore.user));

// Appwrite
const { databases } = useAppwrite();
const config = useRuntimeConfig();

// Form state
const cardType = ref("white");
const cardText = ref("");
const submitting = ref(false);

// Watch for changes to cardType
watch(cardType, (newValue) => {
  console.log("Card type changed to:", newValue);
});

// Ensure cardType is properly initialized on client side
onMounted(() => {
  console.log("Component mounted, cardType:", cardType.value);
  // Force a re-render by setting the value again
  const currentType = cardType.value;
  cardType.value = currentType;
});

// Emit events
const emit = defineEmits(["card-submitted"]);

// Helper function for sanitization (only used when needed)
const sanitizeText = (text: string) => {
  return sanitize(text.trim());
};

const isValidSubmission = computed(() => {
  // Check if text is not empty and within limits
  const trimmedText = cardText.value.trim();
  if (!trimmedText || trimmedText.length < 3) {
    return false;
  }

  // For black cards, ensure there's at least one blank
  if (cardType.value === "black" && calculatePicks.value < 1) {
    return false;
  }

  return true;
});

// Methods
const calculatePicks = computed(() => {
  if (cardType.value !== "black") return 1;

  // Count underscores as picks
  const matches = cardText.value.match(/_/g);
  return matches ? matches.length : 0;
});

async function submitCard() {
  if (!isLoggedIn.value || !isValidSubmission.value || submitting.value) {
    return;
  }

  try {
    submitting.value = true;

    // Create submission data
    const sanitizedCardText = sanitizeText(cardText.value);
    const submissionData = {
      submitterId: userStore.user?.$id,
      submitterName:
        userStore.user?.name || userStore.user?.prefs?.username || "Anonymous",
      cardType: cardType.value,
      text: sanitizedCardText,
      timestamp: new Date().toISOString(),
      upvotes: 0,
      upvoterIds: [],
    };

    // Add pick property for black cards
    if (cardType.value === "black") {
      submissionData.pick = calculatePicks.value;
    }

    // Submit to Appwrite
    const newSubmission = await databases.createDocument(
      config.public.appwriteDatabaseId,
      config.public.appwriteSubmissionCollectionId,
      "unique()",
      submissionData,
    );

    // Emit event with the new submission
    emit("card-submitted", newSubmission);

    // Reset form
    cardText.value = "";

    // Show success message
    useToast().add({
      title: "Success",
      description: "Your card has been submitted!",
      color: "green",
    });
  } catch (error) {
    console.error("Error submitting card:", error);
    useToast().add({
      title: "Error",
      description: "Failed to submit your card. Please try again.",
      color: "red",
    });
  } finally {
    submitting.value = false;
  }
}
</script>

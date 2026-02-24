<template>
  <div class="py-1">
    <!-- Login warning -->
    <div
      v-if="!isLoggedIn"
      class="flex items-center gap-3 p-4 bg-amber-400/10 dark:bg-amber-400/5 border border-amber-400/30 dark:border-amber-400/20 rounded-[0.65rem]"
    >
      <Icon
        name="solar:lock-password-bold-duotone"
        class="text-2xl text-amber-600 dark:text-amber-400 shrink-0"
      />
      <div>
        <p
          class="text-[0.9rem] tracking-[0.06em] text-amber-600 dark:text-amber-400 mb-[0.15rem]"
        >
          Login Required
        </p>
        <p class="text-[0.8rem] text-gray-500 dark:text-slate-400">
          You need to be logged in to submit experiments.
        </p>
      </div>
    </div>

    <form
      v-if="isLoggedIn"
      class="flex flex-col gap-0"
      @submit.prevent="submitCard"
    >
      <!-- Card Type Selector -->
      <div class="flex flex-col gap-2">
        <div
          class="text-[0.7rem] tracking-[0.15em] text-gray-500 dark:text-slate-400 flex items-center gap-[0.35rem]"
        >
          <Icon
            name="solar:layers-minimalistic-bold-duotone"
            class="text-violet-600 dark:text-violet-500 text-[0.9rem]"
          />
          <span>CARD TYPE</span>
        </div>
        <ClientOnly>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-[0.4rem] py-[0.6rem] px-4 rounded-lg text-[0.9rem] tracking-[0.06em] cursor-pointer transition-all duration-200 ease-in-out"
              :class="[
                cardType === 'white'
                  ? 'bg-violet-500/10 border border-violet-500/40 text-gray-600 shadow-[0_0_12px_rgba(139,92,246,0.1)] dark:bg-slate-100/10 dark:border-slate-100/35 dark:text-slate-100 dark:shadow-[0_0_12px_rgba(241,245,249,0.08)]'
                  : 'bg-violet-500/5 border border-slate-500/30 text-gray-500 hover:bg-violet-500/10 hover:text-gray-600 dark:bg-white/5 dark:border-slate-500/25 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200',
              ]"
              @click="cardType = 'white'"
            >
              <Icon name="solar:document-bold-duotone" class="text-[1.1rem]" />
              <span>White Card</span>
            </button>
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-[0.4rem] py-[0.6rem] px-4 rounded-lg text-[0.9rem] tracking-[0.06em] cursor-pointer transition-all duration-200 ease-in-out"
              :class="[
                cardType === 'black'
                  ? 'bg-indigo-950/10 border border-slate-500/50 text-indigo-950 shadow-[0_0_12px_rgba(30,27,75,0.08)] dark:bg-slate-900/80 dark:border-slate-500/50 dark:text-slate-100 dark:shadow-[0_0_12px_rgba(15,23,42,0.3)]'
                  : 'bg-violet-500/5 border border-slate-500/30 text-gray-500 hover:bg-violet-500/10 hover:text-gray-600 dark:bg-white/5 dark:border-slate-500/25 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200',
              ]"
              @click="cardType = 'black'"
            >
              <Icon name="solar:document-bold-duotone" class="text-[1.1rem]" />
              <span>Black Card</span>
            </button>
          </div>
        </ClientOnly>
        <p
          v-if="cardType === 'black'"
          class="flex items-center gap-[0.3rem] text-[0.75rem] text-gray-500 dark:text-slate-500 tracking-[0.03em]"
        >
          <Icon
            name="solar:info-circle-bold-duotone"
            class="text-[0.85rem] text-indigo-500"
          />
          Use underscores (_) to indicate blank spaces.
        </p>
      </div>

      <div
        class="h-[1px] bg-gradient-to-r from-transparent via-violet-500/20 to-transparent my-[0.85rem]"
      />

      <!-- Card Text -->
      <div class="flex flex-col gap-2">
        <div
          class="text-[0.7rem] tracking-[0.15em] text-gray-500 dark:text-slate-400 flex items-center gap-[0.35rem]"
        >
          <Icon
            name="solar:pen-new-square-bold-duotone"
            class="text-violet-600 dark:text-violet-500 text-[0.9rem]"
          />
          <span>CARD TEXT</span>
        </div>
        <ClientOnly>
          <UForm :state="{ cardText }">
            <UTextarea
              v-model="cardText"
              :placeholder="
                cardType === 'white'
                  ? 'Enter your white card text…'
                  : 'Enter your black card text with _ for blanks…'
              "
              :maxlength="200"
              :rows="3"
              class="w-full"
              :disabled="submitting || !isLoggedIn"
            />
          </UForm>
          <div class="flex justify-between mt-[0.35rem]">
            <span
              class="text-[0.7rem] tracking-[0.08em] text-gray-500 dark:text-slate-600"
              >{{ cardText.length }}/200</span
            >
            <span
              v-if="cardType === 'black'"
              class="text-[0.7rem] tracking-[0.08em] text-gray-500 dark:text-slate-600"
            >
              Picks: {{ calculatePicks }}
            </span>
          </div>
        </ClientOnly>
      </div>

      <div
        class="h-[1px] bg-gradient-to-r from-transparent via-violet-500/20 to-transparent my-[0.85rem]"
      />

      <!-- Preview -->
      <div class="flex flex-col gap-2">
        <div
          class="text-[0.7rem] tracking-[0.15em] text-gray-500 dark:text-slate-400 flex items-center gap-[0.35rem]"
        >
          <Icon
            name="solar:eye-bold-duotone"
            class="text-violet-600 dark:text-violet-500 text-[0.9rem]"
          />
          <span>PREVIEW</span>
        </div>
        <ClientOnly>
          <div class="flex justify-center py-2">
            <div v-if="cardType === 'white'" class="max-w-[220px]">
              <WhiteCard :text="cardText.trim()" :threeDeffect="true" />
            </div>
            <div v-else class="max-w-[220px]">
              <BlackCard
                :text="cardText.trim()"
                :numPick="calculatePicks"
                :threeDeffect="true"
              />
            </div>
          </div>
        </ClientOnly>
      </div>

      <div
        class="h-[1px] bg-gradient-to-r from-transparent via-violet-500/20 to-transparent my-[0.85rem]"
      />

      <!-- Submit -->
      <div class="flex justify-end">
        <ClientOnly>
          <UButton
            type="submit"
            color="primary"
            icon="i-solar-test-tube-bold-duotone"
            :loading="submitting"
            :disabled="!isValidSubmission || submitting || !isLoggedIn"
            class="text-base tracking-[0.08em] px-5 py-2"
          >
            Submit Experiment
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
const userStore = useUserStore();
const isLoggedIn = computed(() => isAuthenticatedUser(userStore.user));

import { getAppwrite } from "~/utils/appwrite";
const { tables } = getAppwrite();
const config = useRuntimeConfig();

const cardType = ref("white");
const cardText = ref("");
const submitting = ref(false);

watch(cardType, () => {});

onMounted(() => {
  const currentType = cardType.value;
  cardType.value = currentType;
});

const emit = defineEmits(["card-submitted"]);

const sanitizeText = (text: string) => {
  return sanitize(text.trim());
};

const isValidSubmission = computed(() => {
  const trimmedText = cardText.value.trim();
  if (!trimmedText || trimmedText.length < 3) return false;
  if (cardType.value === "black" && calculatePicks.value < 1) return false;
  return true;
});

const calculatePicks = computed(() => {
  if (cardType.value !== "black") return 1;
  const matches = cardText.value.match(/_/g);
  return matches ? matches.length : 0;
});

async function submitCard() {
  if (!isLoggedIn.value || !isValidSubmission.value || submitting.value) return;

  try {
    submitting.value = true;

    const sanitizedCardText = sanitizeText(cardText.value);
    const submissionData: Record<string, unknown> = {
      submitterId: userStore.user?.$id,
      submitterName:
        userStore.user?.name ||
        (userStore.user?.prefs as Record<string, unknown>)?.username ||
        "Anonymous",
      cardType: cardType.value,
      text: sanitizedCardText,
      timestamp: new Date().toISOString(),
      upvotes: 0,
      upvoterIds: [],
    };

    if (cardType.value === "black") {
      submissionData.pick = calculatePicks.value;
    }

    const newSubmission = await tables.createRow({
      databaseId: config.public.appwriteDatabaseId,
      tableId: config.public.appwriteSubmissionCollectionId,
      rowId: "unique()",
      data: submissionData,
    });

    emit("card-submitted", newSubmission);
    cardText.value = "";

    useToast().add({
      title: "Experiment Submitted!",
      description: "Your card has been submitted to the lab.",
      color: "success",
    });
  } catch (error) {
    console.error("Error submitting card:", error);
    useToast().add({
      title: "Error",
      description: "Failed to submit your card. Please try again.",
      color: "error",
    });
  } finally {
    submitting.value = false;
  }
}
</script>

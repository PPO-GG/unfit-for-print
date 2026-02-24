<script setup lang="ts">
import { useCardImporter } from "~/composables/useCardImporter";

const emit = defineEmits(["upload-complete"]);

const {
  uploadState,
  uploading,
  showPreview,
  previewData,
  previewStats,
  uploadProgress,
  showProgress,
  seedingStats,
  resumePosition,
  showResumePrompt,
  handleFileChange,
  uploadJsonFile,
  resumeUpload,
} = useCardImporter({
  onComplete: () => {
    emit("upload-complete");
  },
});
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-2xl font-bold">Upload Pack JSON</h3>
    </template>

    <UForm :state="uploadState">
      <div
        class="border border-gray-300 rounded p-2 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
      >
        <input
          type="file"
          accept=".json"
          @change="handleFileChange"
          class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-slate-500 dark:file:bg-slate-700 dark:file:text-slate-200"
        />
      </div>
      <p class="text-lg text-slate-500 mt-1">
        Upload a JSON file with card packs
      </p>

      <div
        v-if="showPreview"
        class="mt-4 border rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
      >
        <h4 class="font-semibold mb-2">Preview</h4>
        <div class="flex gap-4 mb-4">
          <div
            class="bg-primary-50 dark:bg-primary-900 p-2 rounded flex-1 text-center"
          >
            <div class="text-lg font-bold">{{ previewStats.packs }}</div>
            <div class="text-xs text-gray-500">Packs</div>
          </div>
          <div
            class="bg-primary-50 dark:bg-primary-900 p-2 rounded flex-1 text-center"
          >
            <div class="text-lg font-bold">{{ previewStats.whiteCards }}</div>
            <div class="text-xs text-gray-500">White Cards</div>
          </div>
          <div
            class="bg-primary-50 dark:bg-primary-900 p-2 rounded flex-1 text-center"
          >
            <div class="text-lg font-bold">{{ previewStats.blackCards }}</div>
            <div class="text-xs text-gray-500">Black Cards</div>
          </div>
        </div>
        <div class="max-h-60 overflow-y-auto">
          <div
            v-for="(pack, i) in previewData"
            :key="i"
            class="mb-2 p-2 border-b"
          >
            <div class="font-medium">
              {{ pack.name || `Pack ${pack.pack || i + 1}` }}
            </div>
            <div class="text-xs text-gray-500">
              {{ pack.white?.length || 0 }} white cards,
              {{ pack.black?.length || 0 }} black cards
            </div>
          </div>
        </div>
      </div>

      <div v-if="showProgress" class="mt-4 space-y-3">
        <div class="flex justify-between text-xs text-gray-500 mb-1">
          <span>
            {{
              seedingStats.currentPack
                ? `Processing pack: ${seedingStats.currentPack}`
                : "Seeding cards..."
            }}
            <span v-if="seedingStats.currentCardType" class="ml-1"
              >({{ seedingStats.currentCardType }} cards)</span
            >
          </span>
          <span>{{ Math.round(uploadProgress * 100) }}%</span>
        </div>
        <UProgress :value="uploadProgress" color="primary" />
        <div
          v-if="seedingStats.totalCards > 0"
          class="text-xs text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1 mt-2"
        >
          <div>Total Cards: {{ seedingStats.totalCards }}</div>
          <div>Packs: {{ seedingStats.totalPacks }}</div>
          <div>White Cards: {{ seedingStats.whiteCardCount }}</div>
          <div>Black Cards: {{ seedingStats.blackCardCount }}</div>
          <div>Inserted: {{ seedingStats.insertedCards }}</div>
          <div>Skipped Duplicates: {{ seedingStats.skippedDuplicates }}</div>
          <div>Skipped Similar: {{ seedingStats.skippedSimilar }}</div>
          <div>Skipped Long Text: {{ seedingStats.skippedLongText }}</div>
          <div>Failed: {{ seedingStats.failedCards }}</div>
        </div>
        <div
          v-if="seedingStats.warnings && seedingStats.warnings.length > 0"
          class="mt-2"
        >
          <UAccordion
            :items="[
              {
                label: `Warnings (${seedingStats.warnings.length})`,
                slot: 'warnings',
                defaultOpen: false,
              },
            ]"
          >
            <template #warnings>
              <div class="text-xs text-amber-500 max-h-32 overflow-y-auto">
                <div
                  v-for="(warning, i) in seedingStats.warnings.slice(0, 10)"
                  :key="i"
                  class="py-1"
                >
                  {{ warning }}
                </div>
                <div
                  v-if="seedingStats.warnings.length > 10"
                  class="py-1 italic"
                >
                  ...and {{ seedingStats.warnings.length - 10 }} more warnings
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
        <div
          v-if="seedingStats.errors && seedingStats.errors.length > 0"
          class="mt-2"
        >
          <UAccordion
            :items="[
              {
                label: `Errors (${seedingStats.errors.length})`,
                slot: 'errors',
                defaultOpen: false,
              },
            ]"
          >
            <template #errors>
              <div class="text-xs text-red-500 max-h-32 overflow-y-auto">
                <div
                  v-for="(error, i) in seedingStats.errors.slice(0, 10)"
                  :key="i"
                  class="py-1"
                >
                  {{ error }}
                </div>
                <div v-if="seedingStats.errors.length > 10" class="py-1 italic">
                  ...and {{ seedingStats.errors.length - 10 }} more errors
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
      </div>

      <div
        v-if="showResumePrompt"
        class="mt-4 p-3 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded-lg"
      >
        <div class="font-medium mb-2">Upload failed</div>
        <p class="text-sm mb-3">
          The upload process was interrupted. Would you like to resume from
          where it left off?
        </p>
        <div class="flex gap-2">
          <UButton size="sm" color="warning" @click="resumeUpload"
            >Resume Upload</UButton
          >
          <UButton size="sm" variant="ghost" @click="showResumePrompt = false"
            >Cancel</UButton
          >
        </div>
      </div>

      <UButton
        :loading="uploading"
        :disabled="!uploadState.file || !uploadState.fileContent"
        @click="uploadJsonFile()"
        color="primary"
        class="mt-4"
        variant="subtle"
      >
        Upload & Seed
      </UButton>
    </UForm>
  </UCard>
</template>

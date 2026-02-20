<script setup lang="ts">
import { ref } from "vue";

const config = useRuntimeConfig();
const endpoint = ref("https://cloud.appwrite.io/v1");
const projectId = ref((config.public as any).appwriteProjectId || "");
const apiKey = ref("");
const isLoading = ref(false);
const result = ref<{
  success: boolean;
  message: string;
  logs?: string[];
} | null>(null);

async function runSetup() {
  if (!apiKey.value || !projectId.value || !endpoint.value) {
    return;
  }

  isLoading.value = true;
  result.value = null;

  try {
    const response = await $fetch("/api/setup", {
      method: "POST",
      body: {
        endpoint: endpoint.value,
        projectId: projectId.value,
        apiKey: apiKey.value,
      },
    });
    result.value = response as {
      success: boolean;
      message: string;
      logs?: string[];
    };
  } catch (error: any) {
    result.value = {
      success: false,
      message: error.message || "An unknown error occurred",
    };
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div
    class="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4"
  >
    <div class="w-full max-w-md space-y-8">
      <div class="text-center">
        <h1 class="text-3xl font-bold">Database Setup</h1>
        <p class="mt-2 text-slate-400">
          Initialize your Appwrite database schema
        </p>
      </div>

      <div
        class="bg-slate-800 p-6 rounded-xl shadow-xl space-y-6 border border-slate-700"
      >
        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-300"
            >Appwrite Endpoint</label
          >
          <UInput
            v-model="endpoint"
            placeholder="https://cloud.appwrite.io/v1"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-300"
            >Project ID</label
          >
          <UInput v-model="projectId" placeholder="Project ID" />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-300"
            >API Key</label
          >
          <UInput
            v-model="apiKey"
            type="password"
            placeholder="API Key (with database permissions)"
          />
          <p class="text-xs text-slate-500">
            Requires: databases.read/write, collections.read/write,
            attributes.read/write
          </p>
        </div>

        <UButton
          block
          size="lg"
          :loading="isLoading"
          @click="runSetup"
          color="primary"
        >
          Run Setup
        </UButton>
      </div>

      <div
        v-if="result"
        :class="[
          'p-4 rounded-lg border',
          result.success
            ? 'bg-green-900/50 border-green-700 text-green-200'
            : 'bg-red-900/50 border-red-700 text-red-200',
        ]"
      >
        <div class="font-bold mb-2">
          {{ result.success ? "Setup Complete!" : "Setup Failed" }}
        </div>
        <div>{{ result.message }}</div>
        <div
          v-if="result.logs && result.logs.length"
          class="mt-4 text-xs font-mono bg-black/30 p-2 rounded max-h-40 overflow-y-auto"
        >
          <div v-for="(log, i) in result.logs" :key="i">{{ log }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

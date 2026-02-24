<template>
  <div class="flex items-center justify-center text-center">
    <div class="p-6 space-y-6 max-w-7xl mx-auto">
      <div
        class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
      >
        <div>
          <h1 class="text-3xl font-bold">
            {{ t("profile.your_profile") }}
          </h1>
          <p class="text-amber-300 text-2xl mt-1">
            WORK IN PROGRESS!
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>

<style></style>

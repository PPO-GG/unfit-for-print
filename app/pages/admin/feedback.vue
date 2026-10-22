<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <ScreenTitle title="Feedback" class="mb-6" />
    <ClientOnly>
      <AdminFeedbackDashboard />
    </ClientOnly>
  </div>
</template>

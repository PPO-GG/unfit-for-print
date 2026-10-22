<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <ScreenTitle title="Issues" class="mb-6" />
    <ClientOnly>
      <AdminIssueInbox />
    </ClientOnly>
  </div>
</template>

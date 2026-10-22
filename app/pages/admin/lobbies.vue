<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <ScreenTitle title="Lobby Monitor" class="mb-6" />
    <ClientOnly>
      <AdminLobbyMonitor />
    </ClientOnly>
  </div>
</template>

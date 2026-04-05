<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink
        to="/admin"
        class="text-slate-400 hover:text-white transition-colors"
      >
        <UIcon name="i-solar-arrow-left-broken" class="text-xl" />
      </NuxtLink>
      <h1 class="text-3xl font-bold">Lobby Monitor</h1>
    </div>
    <ClientOnly>
      <AdminLobbyMonitor />
    </ClientOnly>
  </div>
</template>

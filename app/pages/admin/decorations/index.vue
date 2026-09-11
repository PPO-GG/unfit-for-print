<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});

import { useIsAdmin } from "~/composables/useAdminCheck";

const isAdmin = useIsAdmin();
</script>

<template>
  <div>
    <ClientOnly>
      <div v-if="isAdmin" class="p-6 max-w-7xl mx-auto">
        <AdminDecorationManager />
      </div>
    </ClientOnly>
  </div>
</template>

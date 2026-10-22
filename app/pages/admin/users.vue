<script setup lang="ts">
definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <div class="p-6 max-w-[100rem] w-full mx-auto">
    <ScreenTitle title="User Manager" class="mb-6" />
    <ClientOnly>
      <AdminUserManager />
    </ClientOnly>
  </div>
</template>

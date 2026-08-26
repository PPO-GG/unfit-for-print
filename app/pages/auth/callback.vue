<!-- app/pages/auth/callback.vue -->
<script setup lang="ts">
const userStore = useUserStore();
const route = useRoute();

onMounted(async () => {
  await userStore.fetchSession();
  const returnTo = route.query.returnTo as string | undefined;
  await navigateTo(returnTo && /^\/(?!\/)/.test(returnTo) ? returnTo : "/");
});
</script>

<template>
  <div class="flex h-screen items-center justify-center">
    <p>Signing you in…</p>
  </div>
</template>

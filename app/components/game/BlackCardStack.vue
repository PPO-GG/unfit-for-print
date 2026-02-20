<script setup lang="ts">
// This component is currently unused (dead code).
// It previously relied on a deleted composable (~/composables/not_used/useGame).
// Kept as a placeholder for future implementation.

defineProps<{
  flipped?: boolean;
}>();
</script>

<template>
  <WhiteCard
    class="cursor-pointer transition-all transform hover:scale-105"
    :flipped="flipped ?? false"
  />
</template>

<style scoped></style>

<!--
  Page header with eyebrow / title / sub / right-side action slot.
  Matches the PageHeader component from the design prototype.
-->
<template>
  <header class="page-header">
    <div>
      <div class="eyebrow">{{ eyebrow }}</div>
      <h1 class="page-title">{{ title }}</h1>
      <div v-if="sub" class="page-sub">{{ sub }}</div>
    </div>
    <div v-if="$slots.actions" class="header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  sub?: string;
}>();
</script>

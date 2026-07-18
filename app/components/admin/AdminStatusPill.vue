<!--
  Tiny uppercase status/priority pill. Variant maps to a `.status-pill.X`
  CSS class defined in admin.css.

  Known variants: pending, playtest, live, scheduled, draft, ended,
  high, med, low.
-->
<template>
  <span :class="['status-pill', variant]">
    <slot />
  </span>
</template>

<script setup lang="ts">
defineProps<{ variant: string }>();
</script>

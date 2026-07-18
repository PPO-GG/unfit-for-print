<!--
  Miniature CaH card preview used in admin tables + detail panes.
  Pass `kind` for prompt/answer color treatment.
-->
<template>
  <div :class="['cah-mini', kind]" :style="style">
    <slot>{{ text }}</slot>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue";
import type { AdminCardKind } from "~/types/admin";

defineProps<{
  kind: AdminCardKind;
  /** Optional text content (slot overrides this). */
  text?: string;
  style?: CSSProperties | string;
}>();
</script>

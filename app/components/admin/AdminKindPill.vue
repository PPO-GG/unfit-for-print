<!--
  Prompt/Answer kind chip. Color-codes the card kind in tables.
-->
<template>
  <span :class="['kind-pill', kind]">
    <slot>{{ kind === "prompt" ? "PROMPT" : "ANSWER" }}</slot>
  </span>
</template>

<script setup lang="ts">
import type { AdminCardKind } from "~/types/admin";

defineProps<{ kind: AdminCardKind }>();
</script>

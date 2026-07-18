<!--
  4-dot rarity gauge. 1 dot = common, 4 dots = legendary. Placed inline
  next to rarity labels on decoration tiles, achievement tiles, and the
  hero equipped-decoration card.
-->
<template>
  <div class="rarity-dots" :class="`rare-${rarity}`">
    <div
      v-for="n in 4"
      :key="n"
      class="dot"
      :style="{ opacity: n <= count ? 1 : 0.15 }"
    />
  </div>
</template>

<script setup lang="ts">
import type { Rarity } from "~/types/profile";

const props = defineProps<{ rarity: Rarity }>();

const count = computed(
  () => ({ common: 1, rare: 2, epic: 3, legendary: 4 })[props.rarity],
);
</script>

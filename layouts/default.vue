<template>
  <AppHeader />
  <main>
	  <ScrollingBackground
			  :scale="0.5"
			  :gap="12"
			  :speedPx="15"
	  />
    <slot />
  </main>
</template>
<script setup lang="ts">
import ScrollingBackground from "~/components/ScrollingBackground.vue";
</script>
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
	<AppFooter />
</template>
<script setup lang="ts">
</script>
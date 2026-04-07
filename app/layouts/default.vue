<template>
  <div class="min-h-screen relative subpixel-antialiased cursor-default">
    <ScrollingBackground :gap="12" :scale="0.5" :speedPx="15" />
    <AtmosphericOverlay vignette />

    <!-- Back button: all pages except home and game room -->
    <UButton
      v-if="route.path !== '/' && !route.path.startsWith('/game/')"
      class="fixed top-4 left-4 z-20 text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl"
      color="neutral"
      icon="i-solar-alt-arrow-left-bold-duotone"
      size="xl"
      variant="subtle"
      @click="router.back()"
    />

    <main class="relative z-10 min-h-screen flex flex-col">
      <slot />
    </main>
  </div>
</template>

<script lang="ts" setup>
const route = useRoute();
const router = useRouter();
</script>

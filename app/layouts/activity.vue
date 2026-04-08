<template>
  <div class="relative min-h-screen subpixel-antialiased cursor-default">
    <ScrollingBackground :gap="12" :scale="0.5" :speedPx="15" />

    <!-- Back button -->
    <UButton
      class="fixed top-4 left-4 z-20 text-xl py-2 px-4 cursor-pointer outline-1 dark:outline-none backdrop-blur-2xl"
      color="neutral"
      icon="i-solar-alt-arrow-left-bold-duotone"
      size="xl"
      variant="subtle"
      @click="router.back()"
    />

    <main class="relative z-10 min-h-screen flex flex-col p-4">
      <slot />
    </main>
  </div>
</template>

<script lang="ts" setup>
const router = useRouter();
</script>

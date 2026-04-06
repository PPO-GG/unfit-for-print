<template>
  <div
    class="relative min-h-screen subpixel-antialiased cursor-default"
    :style="{ '--ui-header-height': `${headerSize.height}px` }"
  >
    <ScrollingBackground :gap="12" :scale="0.5" :speedPx="15" />

    <div class="flex flex-col min-h-screen">
      <div ref="headerRef">
        <AppHeader />
      </div>

      <main
        :style="{
          marginTop: `${headerSize.height}px`,
        }"
        class="flex-1 p-4 mt-16"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useElementSize } from "@vueuse/core";

const headerRef = ref(null);
const headerSize = useElementSize(headerRef);
</script>

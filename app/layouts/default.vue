<template>
  <div
    class="min-h-screen relative subpixel-antialiased cursor-default"
    :style="backEdgeStyle"
  >
    <ScrollingBackground :gap="12" :scale="0.5" :speedPx="15" />
    <AtmosphericOverlay vignette />

    <!-- Back button: all pages except home and game room. Stays pinned
         while the page scrolls; ScreenTitle clears its measured right edge. -->
    <ScreenBackButton
      v-if="showsScreenBack(route.path)"
      ref="backButton"
      class="fixed top-[calc(1rem+var(--safe-top))] left-4 z-20"
      :to="getBreadcrumbBackPath(route.path)"
      :label="t(getBreadcrumbBackLabelKey(route.path))"
    />

    <!-- Top inset: in a Discord Activity on a phone, Discord's own header
         sits over the page (see --safe-top in main.css). -->
    <main class="relative z-10 min-h-screen flex flex-col pt-[var(--safe-top)]">
      <slot />
    </main>
  </div>
</template>

<script lang="ts" setup>
import { useElementBounding } from "@vueuse/core";
import {
  BACK_BUTTON_EDGES,
  getBreadcrumbBackLabelKey,
  getBreadcrumbBackPath,
  showsScreenBack,
} from "~/composables/useBreadcrumbBack";

const route = useRoute();
const { t } = useI18n();

const backButton = useTemplateRef("backButton");
const { right: backRight, bottom: backBottom } = useElementBounding(backButton);

// ScreenTitle uses these edges; full-width bars (Card Explorer) use the CSS var.
provide(
  BACK_BUTTON_EDGES,
  computed(() =>
    backRight.value > 0 ? { right: backRight.value, bottom: backBottom.value } : null,
  ),
);
const backEdgeStyle = computed(() =>
  backRight.value > 0 ? { "--screen-back-right": `${backRight.value}px` } : undefined,
);
</script>

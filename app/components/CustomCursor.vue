<script lang="ts" setup>
import { useCursor } from "~/composables/useCursor";

const { cursorRef, animated, init, destroy } = useCursor();

onMounted(() => init());
onUnmounted(() => destroy());
</script>

<template>
  <ClientOnly>
    <!-- JS-animated cursor element (Chromium only) -->
    <Teleport v-if="animated" to="body">
      <div ref="cursorRef" class="custom-cursor">
        <img
          src="/img/cursor/default.svg"
          alt=""
          class="cursor-img cursor-img--default"
          aria-hidden="true"
          draggable="false"
        />
        <img
          src="/img/cursor/pointer.svg"
          alt=""
          class="cursor-img cursor-img--pointer"
          aria-hidden="true"
          draggable="false"
        />
      </div>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.custom-cursor {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 99999;
  pointer-events: none;
  will-change: transform;
  contain: layout style size;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.custom-cursor--visible {
  opacity: 1;
}

/* ── Cursor images ──────────────────────────────────────────── */
.cursor-img {
  position: absolute;
  width: 28px;
  height: 28px;
  max-width: none;
  transition:
    transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275),
    opacity 0.15s ease;
}

/* Default arrow — tip at top-left */
.cursor-img--default {
  top: -2px;
  left: -2px;
  opacity: 1;
}

/* Pointer hand — centered */
.cursor-img--pointer {
  top: -6px;
  left: -6px;
  width: 32px;
  height: 32px;
  opacity: 0;
  transform: scale(0.7);
}

/* ── Pointer state: swap images ──────────────────────────── */
.custom-cursor--pointer .cursor-img--default {
  opacity: 0;
  transform: scale(0.7);
}

.custom-cursor--pointer .cursor-img--pointer {
  opacity: 1;
  transform: scale(1);
}

/* ── Active (click) state: press down effect ──────────────── */
.custom-cursor--active .cursor-img--default {
  transform: scale(0.85);
}

.custom-cursor--active .cursor-img--pointer {
  transform: scale(0.85);
}
</style>

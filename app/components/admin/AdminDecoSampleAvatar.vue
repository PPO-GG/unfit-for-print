<script setup lang="ts">
/** A stand-in avatar of an exact pixel size, for every studio preview. */
defineProps<{ size: number; sample: "photo" | "initials" }>();
</script>

<template>
  <img
    v-if="sample === 'photo'"
    data-testid="sample-avatar"
    src="/pwa-192x192.png"
    alt=""
    class="block rounded-full object-cover"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
  <div
    v-else
    data-testid="sample-avatar"
    class="flex items-center justify-center rounded-full bg-slate-600 font-semibold text-slate-100"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(9, size * 0.38)}px` }"
  >
    UP
  </div>
</template>

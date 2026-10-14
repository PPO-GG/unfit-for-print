<script setup lang="ts">
defineProps<{ source: "discord" | "web" | null }>();
</script>

<template>
  <span
    v-if="source"
    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
    :class="source === 'discord' ? 'bg-[#5865f2]/20 text-[#a5b0ff]' : 'bg-cyan-500/20 text-cyan-300'"
  >
    {{ source === "discord" ? "Discord" : "Web" }}
  </span>
</template>

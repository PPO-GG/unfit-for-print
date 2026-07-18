<!--
  Inline-SVG icon set for the /labs page. Mirrors the icons used in the
  design prototype (labs-data.jsx → *Icon). Kept as raw SVGs instead of
  UIcon because the prototype's stroke weights and shapes don't match
  the Solar icon set exactly.
-->
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    :stroke="filled ? 'none' : 'currentColor'"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    v-bind="$attrs"
  >
    <template v-if="name === 'beaker'">
      <path d="M9 3v6L4 19a2 2 0 002 3h12a2 2 0 002-3l-5-10V3M8 3h8M7 14h10" />
    </template>
    <template v-else-if="name === 'flame'">
      <path
        fill="currentColor"
        stroke="none"
        d="M12 2C8 6 6 9 6 13a6 6 0 0012 0c0-2-1-4-2-5 0 2-1 3-2 3 0-3-1-7-2-9z"
      />
    </template>
    <template v-else-if="name === 'new'">
      <path
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
      />
    </template>
    <template v-else-if="name === 'chart'">
      <path d="M3 3v18h18M7 14l4-4 4 4 6-6" />
    </template>
    <template v-else-if="name === 'grad-cap'">
      <path d="M2 9l10-5 10 5-10 5L2 9zM6 11v6a6 6 0 0012 0v-6" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="name === 'vs'">
      <path d="M3 6l3 12 3-12M15 6l3 12 3-12M11 12h2" />
    </template>
    <template v-else-if="name === 'arrow-up'">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </template>
    <template v-else-if="name === 'arrow-down'">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </template>
    <template v-else-if="name === 'arrow-right'">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </template>
    <template v-else-if="name === 'back'">
      <path d="M15 6L9 12l6 6" />
    </template>
    <template v-else-if="name === 'x'">
      <path d="M18 6L6 18M6 6l12 12" />
    </template>
    <template v-else-if="name === 'grid'">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </template>
    <template v-else-if="name === 'user'">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </template>
    <template v-else-if="name === 'play'">
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </template>
    <template v-else-if="name === 'check'">
      <polyline points="20 6 9 17 4 12" />
    </template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    name:
      | "beaker"
      | "flame"
      | "new"
      | "chart"
      | "grad-cap"
      | "plus"
      | "vs"
      | "arrow-up"
      | "arrow-down"
      | "arrow-right"
      | "back"
      | "x"
      | "grid"
      | "user"
      | "play"
      | "search"
      | "trash"
      | "check";
    size?: number;
    stroke?: number;
    filled?: boolean;
  }>(),
  { size: 14, stroke: 2, filled: false },
);
</script>

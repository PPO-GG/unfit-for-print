<!--
  Central inline-SVG icon set for the admin dashboard.

  Ported verbatim from the design prototype (admin-shared.jsx) to match
  the visual spec exactly. We keep them as raw SVGs rather than routing
  through UIcon because the design relies on specific stroke widths and
  proportions that the Solar icon set doesn't quite match.
-->
<template>
  <svg
    :viewBox="viewBox"
    :width="size"
    :height="size"
    :fill="fill"
    :stroke="stroke"
    :stroke-width="strokeWidth"
    v-bind="$attrs"
  >
    <template v-if="name === 'grid'">
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <rect x="9" y="9" width="5" height="5" />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M8 1.5 L13.5 4 V8 C13.5 11 11 13.5 8 14.5 C5 13.5 2.5 11 2.5 8 V4 Z" />
    </template>
    <template v-else-if="name === 'flag'">
      <path d="M3 2 V14 M3 3 H12 L10 6 L12 9 H3" />
    </template>
    <template v-else-if="name === 'broadcast'">
      <circle cx="8" cy="8" r="2" />
      <path d="M5 5 Q3 8 5 11 M11 5 Q13 8 11 11 M3 3 Q0 8 3 13 M13 3 Q16 8 13 13" />
    </template>
    <template v-else-if="name === 'deck'">
      <rect x="2" y="3" width="9" height="11" rx="1" />
      <rect x="5" y="1" width="9" height="11" rx="1" fill="rgba(0,0,0,0.3)" />
    </template>
    <template v-else-if="name === 'megaphone'">
      <path d="M2 6 V10 H5 L12 14 V2 L5 6 H2 Z" />
      <path d="M14 7 V9" />
    </template>
    <template v-else-if="name === 'chart'">
      <path d="M2 14 L2 2 M2 14 L14 14 M5 11 L5 8 M8 11 L8 5 M11 11 L11 9" />
    </template>
    <template v-else-if="name === 'coin'">
      <circle cx="8" cy="8" r="6" />
      <path d="M6 6 H10 M6 8 H10 M8 5 V11" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="8" cy="6" r="2.5" />
      <path d="M3 14 C3 11 5 10 8 10 C11 10 13 11 13 14" />
    </template>
    <template v-else-if="name === 'log'">
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M5 6 H11 M5 8 H11 M5 10 H9" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L14 14" />
    </template>
    <template v-else-if="name === 'bell'">
      <path d="M3.5 11 V7 C3.5 4.5 5.5 2.5 8 2.5 C10.5 2.5 12.5 4.5 12.5 7 V11 L13.5 12 H2.5 Z" />
      <path d="M6.5 13.5 C6.5 14.3 7.2 15 8 15 C8.8 15 9.5 14.3 9.5 13.5" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="M3 8 L7 12 L13 4" />
    </template>
    <template v-else-if="name === 'x'">
      <path d="M3 3 L13 13 M13 3 L3 13" />
    </template>
    <template v-else-if="name === 'beaker'">
      <path d="M6 2 V6 L3 12 C3 13 4 14 5 14 H11 C12 14 13 13 13 12 L10 6 V2 M5 2 H11" />
    </template>
    <template v-else-if="name === 'arrow_up'">
      <path d="M8 13 V3 M3 8 L8 3 L13 8" />
    </template>
    <template v-else-if="name === 'arrow_down'">
      <path d="M8 3 V13 M3 8 L8 13 L13 8" />
    </template>
    <template v-else-if="name === 'more'">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M8 3 V13 M3 8 H13" />
    </template>
    <template v-else-if="name === 'external'">
      <path d="M9 3 H13 V7 M13 3 L8 8 M11 9 V13 H3 V5 H7" />
    </template>
    <template v-else-if="name === 'signout'">
      <path d="M9 4 H4 V12 H9 M11 6 L13 8 L11 10 M6 8 H13" />
    </template>
    <template v-else-if="name === 'discord'">
      <path
        d="M19.27 5.33A19.79 19.79 0 0015.67 4l-.34.69a17.2 17.2 0 00-7.66 0L7.33 4a19.79 19.79 0 00-3.6 1.33C1.42 9.4.86 13.36 1.14 17.27c1.62 1.21 3.4 2.13 5.27 2.73l.78-1.13c-.79-.3-1.55-.66-2.27-1.08l.39-.31c4.13 1.92 8.62 1.92 12.69 0l.39.31c-.72.42-1.48.78-2.27 1.08l.78 1.13c1.87-.6 3.65-1.52 5.27-2.73.36-4.55-.5-8.47-2.9-11.94zM8.52 15.04c-1.18 0-2.16-1.07-2.16-2.39s.95-2.4 2.16-2.4 2.18 1.07 2.16 2.4c0 1.32-.95 2.39-2.16 2.39zm6.96 0c-1.18 0-2.16-1.07-2.16-2.39s.95-2.4 2.16-2.4 2.18 1.07 2.16 2.4c0 1.32-.95 2.39-2.16 2.39z"
      />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

/** Icon name — matches the original design's symbol set. */
export type AdminIconName =
  | "grid"
  | "shield"
  | "flag"
  | "broadcast"
  | "deck"
  | "megaphone"
  | "chart"
  | "coin"
  | "user"
  | "log"
  | "search"
  | "bell"
  | "check"
  | "x"
  | "beaker"
  | "arrow_up"
  | "arrow_down"
  | "more"
  | "plus"
  | "external"
  | "signout"
  | "discord";

const props = withDefaults(
  defineProps<{
    name: AdminIconName;
    size?: number | string;
  }>(),
  { size: 16 },
);

// Discord logo comes from a 24×24 source; everything else is a 16×16 glyph.
const viewBox = computed(() => (props.name === "discord" ? "0 0 24 24" : "0 0 16 16"));

// Filled vs stroked glyphs.
const fill = computed(() =>
  props.name === "more" || props.name === "discord" ? "currentColor" : "none",
);

const stroke = computed(() =>
  props.name === "more" || props.name === "discord" ? "none" : "currentColor",
);

const strokeWidth = computed(() => {
  if (["check", "x", "arrow_up", "arrow_down"].includes(props.name)) return 2;
  return 1.5;
});
</script>

<!--
  Inline-SVG icon set for UFP brand pages.

  Keeps the same visual weight across the site. We don't use UIcon
  here because the design uses specific proportions the Solar icon
  set doesn't quite match.
-->
<template>
  <svg
    :viewBox="viewBox"
    :width="size"
    :height="size"
    :fill="fill"
    :stroke="stroke"
    :stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    v-bind="$attrs"
  >
    <template v-if="name === 'new'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="name === 'join'">
      <path d="M10 14L4 20M4 14v6h6M20 4l-6 6M20 10V4h-6" />
    </template>
    <template v-else-if="name === 'games'">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9v6M17 9v6M3 12h18" />
    </template>
    <template v-else-if="name === 'how'">
      <path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z" />
      <path d="M8 9h8M8 13h5" />
    </template>
    <template v-else-if="name === 'labs'">
      <path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3" />
    </template>
    <template v-else-if="name === 'profile'">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </template>
    <template v-else-if="name === 'bolt'">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </template>
    <template v-else-if="name === 'trophy'">
      <path d="M6 4h12v3a5 5 0 01-6 5 5 5 0 01-6-5V4z" />
      <path d="M6 5H3v2a3 3 0 003 3M18 5h3v2a3 3 0 01-3 3M9 20h6M12 15v5" />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M12 2l8 4v6c0 4.5-3.5 8.5-8 10-4.5-1.5-8-5.5-8-10V6l8-4z" />
    </template>
    <template v-else-if="name === 'discord'">
      <path
        d="M20.3 4.4A19.8 19.8 0 0016 3l-.2.4a18 18 0 00-7.7 0L7.9 3a19.7 19.7 0 00-4.3 1.4 20.7 20.7 0 00-3.3 13.8A19.9 19.9 0 006.4 20s.7-.9 1.2-1.6a12.8 12.8 0 01-1.9-.9l.5-.4a14 14 0 0011.6 0l.5.4a12.8 12.8 0 01-1.9.9c.5.7 1.2 1.6 1.2 1.6a19.9 19.9 0 006.2-1.8 20.7 20.7 0 00-3.5-13.8zM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s1-2.4 2.1-2.4 2.1 1.1 2.1 2.4-1 2.4-2.1 2.4zm7 0c-1.2 0-2.1-1.1-2.1-2.4s1-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4z"
      />
    </template>
    <template v-else-if="name === 'shuffle'">
      <path d="M16 3l4 3-4 3M2 6h12M8 21l-4-3 4-3M2 18h12" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="M6 9l6 6 6-6" />
    </template>
    <template v-else-if="name === 'bell'">
      <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 004 0" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1A1.7 1.7 0 008 19.4a1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.8.3 1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8 1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"
      />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

export type BrandIconName =
  | "new"
  | "join"
  | "games"
  | "how"
  | "labs"
  | "profile"
  | "bolt"
  | "trophy"
  | "shield"
  | "discord"
  | "shuffle"
  | "chevron-down"
  | "bell"
  | "settings"
  | "logout";

const props = withDefaults(
  defineProps<{
    name: BrandIconName;
    size?: number | string;
  }>(),
  { size: 20 },
);

const viewBox = "0 0 24 24";

const fill = computed(() => (props.name === "discord" ? "currentColor" : "none"));
const stroke = computed(() => (props.name === "discord" ? "none" : "currentColor"));
</script>

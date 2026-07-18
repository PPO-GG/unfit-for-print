<!--
  Avatar with decoration, sized for /profile.

  Renders a UAvatar (falls back to initials) wrapped in AvatarDecoration
  so equipped decorations render on top. Sizes are set inline because
  the hero needs a 220px avatar which is bigger than @nuxt/ui's presets.
-->
<template>
  <AvatarDecoration
    :decoration-id="decorationId ?? undefined"
    :catalog-entry="null"
  >
    <UAvatar
      :src="avatarUrl ?? undefined"
      :alt="alt"
      class="font-display"
      :style="{
        width: `${pixels}px`,
        height: `${pixels}px`,
        fontSize: `${Math.round(pixels * 0.28)}px`,
        background: bg,
        color: '#0a0d1c',
      }"
    >
      <template v-if="!avatarUrl">{{ initials }}</template>
    </UAvatar>
  </AvatarDecoration>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    size?: "sm" | "md" | "lg" | "xl" | "xxl";
    avatarUrl?: string | null;
    initials?: string;
    bg?: string;
    decorationId?: string | null;
    alt?: string;
  }>(),
  {
    size: "md",
    avatarUrl: null,
    initials: "??",
    bg: "oklch(78% 0.20 195)",
    decorationId: null,
    alt: "Avatar",
  },
);

const pixels = computed(() => {
  switch (props.size) {
    case "sm": return 32;
    case "md": return 48;
    case "lg": return 96;
    case "xl": return 220;
    case "xxl": return 280;
    default: return 48;
  }
});
</script>

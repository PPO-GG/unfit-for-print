<template>
  <!--
    Labs preview card. Wraps the canonical game WhiteCard and BlackCard
    components so the Labs feed, H2H, and pack browser use the same
    styling as in-game cards. The size prop maps to the game component
    scale prop (percentage of the default card width). Hover tilt is
    kept because it mirrors the game feel and does not interfere with
    the surrounding Labs layout.
  -->
  <BlackCard
    v-if="kind === 'prompt'"
    :text="text"
    :num-pick="pick ?? 1"
    :scale="scale"
    disable-hover
  />
  <WhiteCard
    v-else
    :text="text"
    :scale="scale"
    flat
    disable-hover
  />
</template>

<script setup lang="ts">
import type { SubmissionKind } from "~/types/labs";

const props = withDefaults(
  defineProps<{
    kind: SubmissionKind;
    text: string;
    /** Visual size; sm/md/lg map to percent scale values. */
    size?: "sm" | "md" | "lg";
    /** Black card blanks. Ignored for white cards. */
    pick?: number;
  }>(),
  { size: "md" },
);

const SCALES = {
  sm: 45,
  md: 70,
  lg: 100,
} as const;

const scale = computed(() => SCALES[props.size]);
</script>

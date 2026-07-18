<!--
  "Favorite answers" panel. Ranks the player's most-winning white cards.
  Mock data today — real impl needs a per-player `card_wins` rollup.
-->
<template>
  <div class="profile-panel p-5">
    <div class="sect-h" style="margin-bottom: 10px">
      <div class="title">Favorite answers</div>
      <div class="count-badge">Most winning</div>
    </div>
    <div class="flex flex-col gap-2">
      <div
        v-for="(c, i) in cards"
        :key="i"
        class="flex items-center gap-3 py-2 border-b last:border-0"
        :style="{ borderColor: 'var(--line)' }"
      >
        <div
          class="font-display w-5"
          style="color: var(--accent-yellow); font-size: 18px"
        >
          {{ i + 1 }}
        </div>
        <div class="flex-1 font-cond leading-snug" style="font-size: 17px">
          {{ c.text }}
        </div>
        <div
          class="font-mono"
          style="
            font-size: 11px;
            color: var(--ink-muted);
            letter-spacing: 0.15em;
          "
        >
          {{ c.wins }}W
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProfileFavCard } from "~/types/profile";

defineProps<{ cards: ProfileFavCard[] }>();
</script>

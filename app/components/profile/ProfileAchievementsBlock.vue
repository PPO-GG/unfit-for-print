<!--
  Grid of achievement tiles. Unlocked achievements render first, then
  locked ones with greyed-out icons. Data source is `useProfileAchievements`
  — all mock today.
-->
<template>
  <div class="flex flex-col gap-4">
    <div class="sect-h" style="margin-bottom: 0">
      <div class="title">
        Achievements ·
        <span style="color: var(--ink-dim)">
          {{ unlockedCount }} / {{ achievements.length }} unlocked
        </span>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div
        v-for="a in orderedAchievements"
        :key="a.id"
        class="ach-tile"
        :class="[`rare-${a.rarity}`, a.unlocked ? 'unlocked' : 'locked']"
      >
        <div class="ach-icon">{{ a.icon }}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <div class="ach-name truncate">{{ a.name }}</div>
            <ProfileRarityDots :rarity="a.rarity" />
          </div>
          <div class="ach-desc">{{ a.desc }}</div>
          <div
            v-if="a.unlocked"
            class="font-mono uppercase mt-1.5"
            :style="{
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: `var(--rare-${a.rarity})`,
            }"
          >
            Unlocked · {{ a.date }}
          </div>
          <div
            v-else-if="a.progress != null && a.target"
            class="font-mono uppercase mt-1.5"
            :style="{
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'var(--ink-muted)',
            }"
          >
            {{ a.progress }} / {{ a.target }}
          </div>
          <div
            v-else
            class="font-mono uppercase mt-1.5"
            :style="{
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'var(--ink-muted)',
            }"
          >
            Locked
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProfileAchievement } from "~/types/profile";

const props = defineProps<{ achievements: ProfileAchievement[] }>();

const unlockedCount = computed(
  () => props.achievements.filter((a) => a.unlocked).length,
);

const orderedAchievements = computed(() => {
  const unlocked = props.achievements.filter((a) => a.unlocked);
  const locked = props.achievements.filter((a) => !a.unlocked);
  return [...unlocked, ...locked];
});
</script>

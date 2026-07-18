<!--
  Hero panel — giant avatar (with rarity ring from equipped decoration),
  name, title chips, level badge + XP bar, and action buttons. The
  equipped-decoration flavor card appears on the right for self-views
  with a decoration equipped.

  The "Edit", "Share", "Settings" actions are wired up in the parent
  page; this component emits intents.
-->
<template>
  <div class="hero-card">
    <div class="relative z-10 flex flex-col md:flex-row gap-8 md:items-center">
      <div class="hero-frame mx-auto md:mx-0" style="margin: 28px 16px">
        <ProfileAvatar
          size="xl"
          :avatar-url="player.avatarUrl"
          :initials="player.initials"
          :bg="player.avatarBg"
          :decoration-id="player.equippedDecoration"
          :alt="player.name"
        />
      </div>

      <!-- Text block -->
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <div v-if="player.discord" class="profile-chip cyan">
            <ProfileIcon name="discord" :size="11" />
            {{ player.discord }}
          </div>
          <div v-if="self" class="profile-chip lime">YOU</div>
          <div v-if="player.title" class="profile-chip yellow">
            <ProfileIcon name="star" :size="11" />
            {{ player.title }}
          </div>
        </div>

        <h1
          class="font-display leading-[0.9] mb-2"
          style="font-size: clamp(48px, 6vw, 88px); color: var(--ink)"
        >
          {{ player.name }}
        </h1>

        <div
          v-if="player.bio"
          class="font-cond italic mb-4"
          style="font-size: 17px; color: var(--ink-dim)"
        >
          "{{ player.bio }}"
        </div>

        <!-- Level + XP -->
        <div class="flex items-center gap-3 mb-3 flex-wrap">
          <div class="level-badge">
            <div class="l">LVL</div>
            <div class="n">{{ player.level }}</div>
          </div>
          <div class="flex-1 max-w-md min-w-[180px]">
            <div class="flex justify-between mb-1.5">
              <div
                class="font-mono uppercase"
                style="
                  font-size: 10px;
                  letter-spacing: 0.2em;
                  color: var(--ink-muted);
                "
              >
                XP · level {{ player.level + 1 }}
              </div>
              <div
                class="font-mono uppercase"
                style="
                  font-size: 10px;
                  letter-spacing: 0.2em;
                  color: var(--ink-dim);
                "
              >
                {{ player.xp.toLocaleString() }} /
                {{ player.xpNext.toLocaleString() }}
              </div>
            </div>
            <div class="xp-bar">
              <div
                class="fill"
                :style="{
                  width: `${Math.min((player.xp / Math.max(player.xpNext, 1)) * 100, 100)}%`,
                }"
              />
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2 mt-2">
          <template v-if="self">
            <button class="profile-btn" @click="emit('edit')">
              <ProfileIcon name="edit" :size="14" /> Edit profile
            </button>
            <button class="profile-btn" @click="emit('share')">
              <ProfileIcon name="share" :size="14" /> Share
            </button>
            <button class="profile-btn" @click="emit('settings')">
              <ProfileIcon name="settings" :size="14" /> Settings
            </button>
          </template>
          <template v-else>
            <button class="profile-btn primary" @click="emit('addFriend')">
              <ProfileIcon name="users" :size="14" /> Add friend
            </button>
            <button class="profile-btn" @click="emit('invite')">
              <ProfileIcon name="play" :size="14" /> Invite to game
            </button>
            <button class="profile-btn" @click="emit('share')">
              <ProfileIcon name="share" :size="14" /> Share profile
            </button>
          </template>
        </div>
      </div>

      <!-- Equipped decoration flavor card (self only) -->
      <div
        v-if="equippedEntry"
        class="profile-panel p-4 flex-shrink-0"
        :class="`rare-${equippedEntry.rarity}`"
        :style="{
          minWidth: '220px',
          maxWidth: '260px',
          borderColor:
            'color-mix(in oklch, var(--rare) 40%, transparent)',
          background:
            'linear-gradient(180deg, color-mix(in oklch, var(--rare) 8%, transparent), rgba(10,13,28,0.8))',
        }"
      >
        <div
          class="font-mono uppercase mb-2"
          style="
            font-size: 9px;
            letter-spacing: 0.2em;
            color: var(--ink-muted);
          "
        >
          Equipped
        </div>
        <div class="flex items-center gap-2 mb-1">
          <ProfileRarityDots :rarity="equippedEntry.rarity as Rarity" />
          <span class="rarity-label">{{
            equippedEntry.rarity.toUpperCase()
          }}</span>
        </div>
        <div
          class="font-display my-1"
          style="font-size: 20px; line-height: 1; color: var(--ink)"
        >
          {{ equippedEntry.name }}
        </div>
        <div
          class="font-cond mb-3 leading-snug"
          style="font-size: 13px; color: var(--ink-dim)"
        >
          {{ equippedEntry.description }}
        </div>
        <button
          v-if="self"
          class="profile-btn w-full"
          style="padding: 6px 10px; font-size: 10px"
          @click="emit('changeDecoration')"
        >
          Change decoration
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProfilePlayer, Rarity } from "~/types/profile";
import type { DecorationCatalogEntry } from "~/types/decoration";

defineProps<{
  player: ProfilePlayer;
  self: boolean;
  equippedEntry?: DecorationCatalogEntry | null;
}>();

const emit = defineEmits<{
  edit: [];
  share: [];
  settings: [];
  addFriend: [];
  invite: [];
  changeDecoration: [];
}>();
</script>

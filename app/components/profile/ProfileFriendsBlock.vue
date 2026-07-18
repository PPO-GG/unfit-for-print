<!--
  Friends panel — avatar + name + presence dot + activity subtitle.
  Friends system + presence isn't built yet (all mock). Only the "Join"
  button would actually route somewhere when wired.
-->
<template>
  <div class="profile-panel p-5 flex flex-col gap-3">
    <div class="sect-h" style="margin-bottom: 0">
      <div class="title">
        Friends ·
        <span style="color: var(--ink-dim)">{{ onlineCount }} online</span>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div v-for="f in friends" :key="f.id" class="friend-row">
        <div class="relative">
          <UAvatar
            :alt="f.name"
            class="font-display"
            :style="{
              width: '48px',
              height: '48px',
              background: f.bg,
              color: '#0a0d1c',
              fontSize: '14px',
            }"
          >
            {{ f.initials }}
          </UAvatar>
          <div
            :style="{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: dotColor(f.status),
              border: '2px solid var(--bg-0, #05060d)',
            }"
          />
        </div>

        <div class="flex-1 min-w-0">
          <div
            class="font-display uppercase leading-tight"
            style="font-size: 14px"
          >
            {{ f.name }}
          </div>
          <div
            class="font-mono uppercase truncate"
            :style="{
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'var(--ink-muted)',
            }"
          >
            {{ f.activity }}
          </div>
        </div>

        <button
          v-if="f.status === 'online' && f.activity === 'Playing'"
          class="profile-btn"
          style="padding: 6px 10px; font-size: 10px"
        >
          <ProfileIcon name="play" :size="11" /> Join
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FriendStatus, ProfileFriend } from "~/types/profile";

defineProps<{ friends: ProfileFriend[]; onlineCount: number }>();

function dotColor(status: FriendStatus) {
  if (status === "online") return "var(--accent-lime)";
  if (status === "idle") return "var(--accent-yellow)";
  return "var(--ink-muted)";
}
</script>

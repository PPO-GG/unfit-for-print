<!--
  Sticky top bar: command-palette-style search + env indicator +
  notifications + view-site shortcut.

  Search is currently a visual placeholder (non-functional). A future
  pass will bind ⌘K to an actual command palette (users, cards, lobbies,
  reports). See docs/admin-ui-future-features.md.
-->
<template>
  <div class="admin-topbar">
    <div class="search-wrap">
      <AdminIcon name="search" :size="14" />
      <input
        v-model="query"
        placeholder="Search users, cards, lobbies, reports… (⌘K)"
      />
      <kbd>⌘K</kbd>
    </div>
    <div class="topbar-actions">
      <span class="env-pill">{{ envLabel }}</span>
      <button class="icon-btn" title="Notifications">
        <AdminIcon name="bell" :size="14" />
        <span class="dot" />
      </button>
      <NuxtLink to="/" class="icon-btn" title="View site">
        <AdminIcon name="external" :size="14" />
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const query = ref("");

/** Mirrors the design's PROD pill. Derive from runtime config. */
const envLabel = computed<string>(() => {
  const cfg = useRuntimeConfig().public as Record<string, unknown>;
  const env = (cfg.env || cfg.nodeEnv || "prod") as string;
  return env.toUpperCase();
});
</script>

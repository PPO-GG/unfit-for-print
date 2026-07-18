<!--
  Left sidebar: brand row, grouped nav, user card at the bottom.
  Reads nav + user data from useAdminNav().
-->
<template>
  <aside class="admin-sidebar">
    <NuxtLink to="/" class="brand-row">
      <div class="brand-logo">UFP</div>
      <div class="brand-meta">
        <div class="brand-name">UNFIT FOR PRINT</div>
        <div class="brand-sub">Admin · v{{ version }}</div>
      </div>
    </NuxtLink>

    <nav class="admin-nav">
      <div v-for="sec in nav" :key="sec.section" class="admin-nav-section">
        <div class="nav-section-label">{{ sec.section }}</div>
        <component
          :is="item.soon ? 'span' : (resolveNuxtLink as any)"
          v-for="item in sec.items"
          :key="item.id"
          :to="item.soon ? undefined : item.to"
          :class="[
            'nav-item',
            { active: item.id === activeId, soon: item.soon },
          ]"
          @click="item.soon && $event.preventDefault()"
        >
          <span class="nav-icon">
            <AdminIcon :name="item.icon" />
          </span>
          <span class="nav-label">{{ item.label }}</span>
          <span
            v-if="item.badge"
            :class="['nav-badge', item.badgeColor]"
          >{{ item.badge }}</span>
          <span v-if="item.soon" class="nav-soon">SOON</span>
        </component>
      </div>
    </nav>

    <div class="user-card">
      <div class="user-avatar" :style="{ background: user.bg }">{{ user.initials }}</div>
      <div class="user-meta">
        <div class="user-name">{{ user.name }}</div>
        <div class="user-role">
          <span class="role-dot" />{{ user.role }}
        </div>
      </div>
      <button class="user-action" title="Sign out" @click="onSignOut">
        <AdminIcon name="signout" :size="12" />
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { resolveComponent } from "vue";

defineProps<{
  /** Current nav item id (matches ADMIN_NAV item ids). */
  activeId: string;
}>();

const { nav, user } = useAdminNav();

const version = __VERSION__;

// Resolve NuxtLink once so we can use it via the <component :is> dynamic binding.
const resolveNuxtLink = resolveComponent("NuxtLink");

async function onSignOut() {
  // Hook into the existing user store when wiring up real auth. For now
  // navigate home — matches the design's "sign out" affordance.
  await navigateTo("/");
}
</script>

<style scoped>
.admin-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 8px 16px;
}

.admin-nav-section {
  margin-top: 14px;
}

.user-meta {
  flex: 1;
  min-width: 0;
}
</style>

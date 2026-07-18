<!--
  Admin layout — dark dashboard shell. Used by all pages under /admin/*
  that are part of the new admin UI. Pages opt in with:

    definePageMeta({ layout: "admin", middleware: "admin" })

  The shell class `admin-root` scopes all styles in ~/assets/css/admin.css
  so none of it leaks onto other pages.
-->
<template>
  <div class="admin-root">
    <ClientOnly>
      <AdminSidebar :active-id="activeId" />
      <div class="admin-main">
        <AdminTopBar />
        <div class="admin-content">
          <slot />
        </div>
      </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();

/**
 * Resolve which nav item should light up based on the route.
 * The mapping mirrors `ADMIN_NAV` targets.
 */
const activeId = computed<string>(() => {
  const p = route.path;
  if (p === "/admin" || p === "/admin/") return "overview";
  if (p.startsWith("/admin/moderation")) return "moderation";
  if (p.startsWith("/admin/reports")) return "reports";
  if (p.startsWith("/admin/cards")) return "cards";
  if (p.startsWith("/admin/announcements")) return "announcements";
  if (p.startsWith("/admin/lobbies")) return "lobbies";
  if (p.startsWith("/admin/analytics")) return "analytics";
  if (p.startsWith("/admin/revenue")) return "revenue";
  if (p.startsWith("/admin/users")) return "users";
  if (p.startsWith("/admin/audit")) return "audit";
  return "";
});
</script>

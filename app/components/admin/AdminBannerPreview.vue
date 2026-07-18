<!--
  Announcement banner preview. Renders the dark CTA button + colored
  gradient strip the way it'll appear on the public site.
-->
<template>
  <div :class="['banner-preview', color]">
    <div class="banner-body-wrap">
      <div class="banner-title">{{ title }}</div>
      <div class="banner-body">{{ body }}</div>
    </div>
    <button type="button" class="banner-cta">{{ cta }} →</button>
  </div>
</template>

<script setup lang="ts">
import type { AdminAnnouncementBannerColor } from "~/types/admin";

defineProps<{
  title: string;
  body: string;
  cta: string;
  color: AdminAnnouncementBannerColor;
}>();
</script>

<style scoped>
.banner-body-wrap {
  flex: 1;
}

.banner-cta {
  padding: 8px 16px;
  background: rgba(13, 15, 26, 0.85);
  color: #f6f3ea;
  border: none;
  border-radius: 6px;
  font-family: "Archivo Black", sans-serif;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
</style>

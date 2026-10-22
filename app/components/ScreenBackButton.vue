<template>
  <NuxtLink
    :to="to"
    class="screen-back lobby-tokens"
    :aria-label="t('nav.back_to', { name: label })"
  >
    <span aria-hidden="true">↩</span> {{ label }}
  </NuxtLink>
</template>

<script lang="ts" setup>
// The one control that returns to the parent screen; the layout owns it.
defineProps<{ to: string; label: string }>();

const { t } = useI18n();
</script>

<style scoped>
/* The lobby's chunky .neon-btn look, sized for a thumb. */
.screen-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  min-width: 44px;
  padding: 10px 16px;
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--lb-ink);
  background: color-mix(in srgb, var(--lb-bg-1) 72%, transparent);
  border: 1.5px solid var(--lb-line-strong);
  border-radius: 8px;
  box-shadow: 0 5px 0 0 var(--lb-bg-0);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
}

.screen-back:hover {
  border-color: var(--lb-accent);
  transform: translateY(-2px);
  box-shadow: 0 7px 0 0 var(--lb-bg-0);
}

.screen-back:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 0 var(--lb-bg-0);
}

.screen-back:focus-visible {
  outline: 2px solid var(--lb-accent);
  outline-offset: 3px;
}
</style>

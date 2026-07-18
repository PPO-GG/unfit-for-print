<template>
  <footer class="brand-footer">
    <!-- <div class="tickertape brand-footer-tickertape">
      <span class="tickertape-inner">
        <span
          v-for="(item, i) in doubledItems"
          :key="i"
          class="brand-footer-ticker-item"
        >
          {{ item }}
        </span>
      </span>
    </div> -->

    <div class="brand-footer-row">
      <div class="brand-footer-links font-mono">
        <span>© {{ year }} Unfit For Print</span>
        <span class="brand-footer-sep">·</span>
        <NuxtLink to="/about">About</NuxtLink>
        <NuxtLink to="/legal/termsofservice">Terms</NuxtLink>
        <NuxtLink to="/legal/privacypolicy">Privacy</NuxtLink>
        <NuxtLink to="/changelog">Changelog</NuxtLink>
      </div>
      <!-- <div class="brand-footer-status font-mono">
        <BrandLiveDot :size="6" />
        All systems live · {{ latencyMs }}ms
      </div> -->
    </div>
  </footer>
</template>

<script setup lang="ts">
const { items } = useBrandTicker();

/** Duplicated to make the CSS marquee loop seamlessly. */
const doubledItems = computed(() => [...items.value, ...items.value]);

const year = new Date().getFullYear();
/** Latency placeholder — wire to a real /health endpoint eventually. */
const latencyMs = 38;
</script>

<style scoped>
.brand-footer {
  position: relative;
  z-index: 10;
  border-top: 1px solid var(--line);
}

.brand-footer-tickertape {
  padding: 10px 0;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-dim);
}

.brand-footer-ticker-item {
  margin-right: 48px;
}

.brand-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-top: 1px solid var(--line);
  color: var(--ink-muted);
  gap: 12px;
  flex-wrap: wrap;
}

@media (min-width: 768px) {
  .brand-footer-row {
    padding: 12px 40px;
  }
}

.brand-footer-links {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  flex-wrap: wrap;
}

.brand-footer-links a:hover {
  color: var(--ink);
}

.brand-footer-sep {
  opacity: 0.5;
}

.brand-footer-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
</style>

<template>
  <div class="lobby-round-preview lobby-panel">
    <div class="lrp-label">
      <div class="lrp-label-kicker">Round 01 preview</div>
      <div class="lrp-label-title">YOU'LL DRAW</div>
    </div>
    <div class="lrp-stats">
      <div class="lrp-stat">
        <div class="lrp-stat-val">{{ cardsPerPlayer }}</div>
        <div class="lrp-stat-lbl">White cards</div>
      </div>
      <div class="lrp-stat">
        <div class="lrp-stat-val">1</div>
        <div class="lrp-stat-lbl">Black card</div>
      </div>
      <div class="lrp-stat">
        <div class="lrp-stat-val">≤ {{ maxPick }}</div>
        <div class="lrp-stat-lbl">Pick</div>
      </div>
      <div class="lrp-stat">
        <div class="lrp-stat-val">{{ activePacksCount }}</div>
        <div class="lrp-stat-lbl">Packs</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  cardsPerPlayer: number;
  maxPick: number;
  activePacksCount: number;
}>();
</script>

<style scoped>
.lobby-round-preview {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}
.lrp-label-kicker {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-ink-muted);
}
.lrp-label-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 22px;
  line-height: 1;
  margin-top: 4px;
  color: var(--lb-ink);
}
.lrp-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.lrp-stat {
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid var(--lb-line);
  background: rgba(255, 255, 255, 0.02);
  min-width: 72px;
}
.lrp-stat-val {
  font-family: 'Archivo Black', sans-serif;
  font-size: 20px;
  line-height: 1;
  color: var(--lb-ink);
}
.lrp-stat-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--lb-ink-muted);
  margin-top: 6px;
}
</style>

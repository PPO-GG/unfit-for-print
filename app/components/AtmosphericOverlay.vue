<script lang="ts" setup>
defineProps<{
  vignette?: boolean;
}>();
</script>

<template>
  <div class="atmospheric-overlay" aria-hidden="true">
    <div class="atmo-glow atmo-glow--primary" />
    <div class="atmo-glow atmo-glow--secondary" />
    <div v-if="vignette" class="atmo-vignette" />
  </div>
</template>

<style scoped>
.atmospheric-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.atmo-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.06;
}

.atmo-glow--primary {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.4), transparent);
  top: -10%;
  left: 30%;
}

.atmo-glow--secondary {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.3), transparent);
  bottom: -5%;
  right: 20%;
}

.atmo-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 50% 50%,
    transparent 40%,
    rgba(0, 0, 0, 0.5) 100%
  );
}
</style>

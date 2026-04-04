<template>
  <div
    class="founder-ring"
    :style="{ width: `${config.containerPx}px`, height: `${config.containerPx}px` }"
  >
    <div class="founder-ring__glow" />
    <div
      class="founder-ring__border"
      :style="{ borderWidth: config.borderWidth }"
    />
    <div class="founder-ring__avatar">
      <slot />
    </div>
    <div class="founder-ring__orbit">
      <svg
        v-for="(sparkle, i) in config.sparkles"
        :key="`cw-${i}`"
        class="founder-ring__sparkle"
        :style="{
          left: `${sparkle.x}%`,
          top: `${sparkle.y}%`,
          width: `${sparkle.w}px`,
          height: `${sparkle.w}px`,
          animationDuration: `${sparkle.dur}s`,
          animationDelay: `${sparkle.delay}s`,
          color: toneColor(sparkle.tone),
        }"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41Z" />
      </svg>
    </div>
    <div class="founder-ring__orbit founder-ring__orbit--reverse">
      <svg
        v-for="(sparkle, i) in config.reverseSparkles"
        :key="`ccw-${i}`"
        class="founder-ring__sparkle"
        :style="{
          left: `${sparkle.x}%`,
          top: `${sparkle.y}%`,
          width: `${sparkle.w}px`,
          height: `${sparkle.w}px`,
          animationDuration: `${sparkle.dur}s`,
          animationDelay: `${sparkle.delay}s`,
          color: toneColor(sparkle.tone),
        }"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41Z" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type DecorationSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type SparkTone = 'yellow' | 'amber' | 'white'

interface Sparkle {
  x: number
  y: number
  w: number
  tone: SparkTone
  dur: number
  delay: number
}

interface SizeConfig {
  containerPx: number
  borderWidth: string
  sparkles: Sparkle[]
  reverseSparkles: Sparkle[]
}

const props = withDefaults(
  defineProps<{ size?: DecorationSize }>(),
  { size: 'md' }
)

function toneColor(tone: SparkTone): string {
  switch (tone) {
    case 'yellow': return '#fde047'
    case 'amber':  return '#fbbf24'
    case 'white':  return '#fef9c3'
  }
}

const SIZE_CONFIGS: Record<DecorationSize, SizeConfig> = {
  xs: {
    containerPx: 48,
    borderWidth: '2px',
    sparkles: [
      { x: 50,  y: 4,   w: 4, tone: 'yellow', dur: 1.7, delay: 0.0 },
      { x: 96,  y: 50,  w: 5, tone: 'amber',  dur: 2.1, delay: 0.4 },
      { x: 50,  y: 96,  w: 4, tone: 'white',  dur: 1.9, delay: 0.9 },
      { x: 4,   y: 50,  w: 5, tone: 'yellow', dur: 2.4, delay: 1.3 },
    ],
    reverseSparkles: [],
  },
  sm: {
    containerPx: 56,
    borderWidth: '2px',
    sparkles: [
      { x: 50,  y: 3,   w: 4, tone: 'yellow', dur: 1.7, delay: 0.0 },
      { x: 85,  y: 15,  w: 5, tone: 'amber',  dur: 2.0, delay: 0.3 },
      { x: 97,  y: 50,  w: 6, tone: 'white',  dur: 1.9, delay: 0.7 },
      { x: 85,  y: 85,  w: 4, tone: 'yellow', dur: 2.3, delay: 1.1 },
      { x: 50,  y: 97,  w: 5, tone: 'amber',  dur: 1.8, delay: 0.5 },
    ],
    reverseSparkles: [
      { x: 15,  y: 15,  w: 7, tone: 'white',  dur: 2.5, delay: 0.2 },
      { x: 3,   y: 50,  w: 5, tone: 'yellow', dur: 2.1, delay: 0.8 },
    ],
  },
  md: {
    containerPx: 80,
    borderWidth: '3px',
    sparkles: [
      { x: 50,  y: 2,   w: 5, tone: 'yellow', dur: 1.7, delay: 0.0 },
      { x: 79,  y: 8,   w: 6, tone: 'amber',  dur: 2.0, delay: 0.3 },
      { x: 96,  y: 32,  w: 7, tone: 'white',  dur: 1.9, delay: 0.6 },
      { x: 96,  y: 68,  w: 5, tone: 'yellow', dur: 2.2, delay: 1.0 },
      { x: 79,  y: 92,  w: 8, tone: 'amber',  dur: 1.8, delay: 0.4 },
      { x: 50,  y: 98,  w: 6, tone: 'white',  dur: 2.4, delay: 0.9 },
      { x: 21,  y: 92,  w: 5, tone: 'yellow', dur: 2.1, delay: 1.3 },
    ],
    reverseSparkles: [
      { x: 4,   y: 68,  w: 7, tone: 'amber',  dur: 2.7, delay: 0.1 },
      { x: 4,   y: 32,  w: 6, tone: 'white',  dur: 1.9, delay: 0.6 },
      { x: 21,  y: 8,   w: 8, tone: 'yellow', dur: 2.3, delay: 1.1 },
    ],
  },
  lg: {
    containerPx: 120,
    borderWidth: '3px',
    sparkles: [
      { x: 50,  y: 1,   w: 6,  tone: 'yellow', dur: 1.7, delay: 0.0 },
      { x: 73,  y: 4,   w: 8,  tone: 'amber',  dur: 2.0, delay: 0.2 },
      { x: 93,  y: 18,  w: 7,  tone: 'white',  dur: 1.9, delay: 0.5 },
      { x: 99,  y: 43,  w: 9,  tone: 'yellow', dur: 2.2, delay: 0.8 },
      { x: 93,  y: 68,  w: 6,  tone: 'amber',  dur: 1.8, delay: 1.1 },
      { x: 73,  y: 86,  w: 10, tone: 'white',  dur: 2.5, delay: 0.3 },
      { x: 50,  y: 99,  w: 7,  tone: 'yellow', dur: 2.1, delay: 0.7 },
      { x: 27,  y: 86,  w: 8,  tone: 'amber',  dur: 1.9, delay: 1.4 },
    ],
    reverseSparkles: [
      { x: 7,   y: 68,  w: 9,  tone: 'white',  dur: 2.6, delay: 0.1 },
      { x: 1,   y: 43,  w: 7,  tone: 'yellow', dur: 2.0, delay: 0.5 },
      { x: 7,   y: 18,  w: 8,  tone: 'amber',  dur: 2.8, delay: 1.0 },
    ],
  },
  xl: {
    containerPx: 200,
    borderWidth: '3px',
    sparkles: [
      { x: 50,  y: 0,   w: 7,  tone: 'yellow', dur: 1.7, delay: 0.0 },
      { x: 68,  y: 2,   w: 9,  tone: 'amber',  dur: 2.0, delay: 0.2 },
      { x: 84,  y: 8,   w: 10, tone: 'white',  dur: 1.8, delay: 0.5 },
      { x: 96,  y: 21,  w: 11, tone: 'yellow', dur: 2.2, delay: 0.8 },
      { x: 100, y: 38,  w: 8,  tone: 'amber',  dur: 1.9, delay: 1.1 },
      { x: 96,  y: 56,  w: 12, tone: 'white',  dur: 2.4, delay: 0.3 },
      { x: 84,  y: 72,  w: 9,  tone: 'yellow', dur: 1.7, delay: 0.7 },
      { x: 68,  y: 84,  w: 13, tone: 'amber',  dur: 2.1, delay: 1.2 },
      { x: 50,  y: 100, w: 8,  tone: 'white',  dur: 1.9, delay: 0.4 },
    ],
    reverseSparkles: [
      { x: 32,  y: 84,  w: 10, tone: 'yellow', dur: 2.6, delay: 0.1 },
      { x: 16,  y: 72,  w: 8,  tone: 'amber',  dur: 2.0, delay: 0.6 },
      { x: 4,   y: 56,  w: 11, tone: 'white',  dur: 2.8, delay: 1.0 },
      { x: 0,   y: 38,  w: 7,  tone: 'yellow', dur: 2.3, delay: 1.5 },
    ],
  },
}

const config = computed<SizeConfig>(() => SIZE_CONFIGS[props.size])
</script>

<style scoped>
@keyframes founder-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes founder-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%       { opacity: 0.7; transform: scale(1.04); }
}

@keyframes founder-twinkle {
  0%   { opacity: 0;    transform: translate(-50%, -50%) scale(0.6) rotate(0deg); }
  20%  { opacity: 1;    transform: translate(-50%, -50%) scale(1)   rotate(30deg); }
  50%  { opacity: 0.9;  transform: translate(-50%, -50%) scale(1.1) rotate(60deg); }
  80%  { opacity: 1;    transform: translate(-50%, -50%) scale(0.9) rotate(90deg); }
  100% { opacity: 0;    transform: translate(-50%, -50%) scale(0.6) rotate(120deg); }
}

.founder-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.founder-ring__glow {
  position: absolute;
  inset: 8%;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.2);
  filter: blur(12px);
  animation: founder-pulse 4s ease-in-out infinite;
}

.founder-ring__border {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  border-style: solid;
  border-color: transparent;
  background:
    linear-gradient(#020617, #020617) padding-box,
    conic-gradient(from 0deg, #b45309, #fde047, #f59e0b, #fbbf24, #fde047, #b45309) border-box;
  animation: founder-spin 6s linear infinite;
  z-index: 1;
}

.founder-ring__avatar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.founder-ring__orbit {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  animation: founder-spin 10s linear infinite;
  z-index: 3;
  pointer-events: none;
}

.founder-ring__orbit--reverse {
  animation: founder-spin 14s linear infinite reverse;
}

.founder-ring__sparkle {
  position: absolute;
  transform: translate(-50%, -50%);
  animation: founder-twinkle 2s ease-in-out infinite;
}
</style>

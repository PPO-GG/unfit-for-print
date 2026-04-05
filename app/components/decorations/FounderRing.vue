<template>
  <div class="founder-ring">
    <div class="founder-ring__glow" />
    <div
      class="founder-ring__border"
      :style="{ borderWidth: `${borderPx}px`, inset: `-${borderPx}px` }"
    />
    <div ref="avatarEl" class="founder-ring__avatar">
      <slot />
    </div>
    <div class="founder-ring__orbit">
      <svg
        v-for="(s, i) in cwSparkles"
        :key="`cw-${i}`"
        class="founder-ring__sparkle"
        :style="{
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: `${s.w}px`,
          height: `${s.w}px`,
          animationDuration: `${s.dur}s`,
          animationDelay: `${s.delay}s`,
          color: TONE_COLORS[s.tone],
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
        v-for="(s, i) in ccwSparkles"
        :key="`ccw-${i}`"
        class="founder-ring__sparkle"
        :style="{
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: `${s.w}px`,
          height: `${s.w}px`,
          animationDuration: `${s.dur}s`,
          animationDelay: `${s.delay}s`,
          color: TONE_COLORS[s.tone],
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
import { ref, computed, onMounted, onUnmounted } from 'vue'

type SparkTone = 'yellow' | 'amber' | 'white'

const TONE_COLORS: Record<SparkTone, string> = {
  yellow: '#fde047',
  amber: '#fbbf24',
  white: '#fef9c3',
}

// Canonical sparkle positions — evenly distributed around the orbit circle.
// wMul varies size per sparkle for visual interest (applied to a sqrt-scaled base).
const CW_TEMPLATES: { x: number; y: number; tone: SparkTone; dur: number; delay: number; wMul: number }[] = [
  { x: 50,  y: 0,   tone: 'yellow', dur: 1.7, delay: 0.0, wMul: 0.85 },
  { x: 79,  y: 8,   tone: 'amber',  dur: 2.0, delay: 0.3, wMul: 1.0  },
  { x: 96,  y: 32,  tone: 'white',  dur: 1.9, delay: 0.6, wMul: 1.1  },
  { x: 96,  y: 68,  tone: 'yellow', dur: 2.2, delay: 1.0, wMul: 0.85 },
  { x: 79,  y: 92,  tone: 'amber',  dur: 1.8, delay: 0.4, wMul: 1.2  },
  { x: 50,  y: 98,  tone: 'white',  dur: 2.4, delay: 0.9, wMul: 1.0  },
  { x: 21,  y: 92,  tone: 'yellow', dur: 2.1, delay: 1.3, wMul: 0.85 },
  { x: 21,  y: 8,   tone: 'amber',  dur: 2.0, delay: 0.2, wMul: 1.1  },
  { x: 4,   y: 50,  tone: 'white',  dur: 1.9, delay: 0.8, wMul: 0.9  },
]

const CCW_TEMPLATES: typeof CW_TEMPLATES = [
  { x: 4,   y: 68,  tone: 'amber',  dur: 2.7, delay: 0.1, wMul: 1.15 },
  { x: 4,   y: 32,  tone: 'white',  dur: 1.9, delay: 0.6, wMul: 1.0  },
  { x: 68,  y: 84,  tone: 'yellow', dur: 2.3, delay: 1.1, wMul: 1.1  },
  { x: 32,  y: 84,  tone: 'yellow', dur: 2.6, delay: 0.1, wMul: 0.9  },
]

// --- measure the slotted avatar ---
const avatarEl = ref<HTMLElement | null>(null)
const avatarPx = ref(48)
let observer: ResizeObserver | null = null

onMounted(() => {
  if (!avatarEl.value) return
  const measure = () => {
    const w = avatarEl.value?.offsetWidth
    if (w && w > 0) avatarPx.value = w
  }
  measure()
  observer = new ResizeObserver(measure)
  observer.observe(avatarEl.value)
})
onUnmounted(() => observer?.disconnect())

// --- derived decoration values ---
const borderPx = computed(() => Math.max(2, Math.round(avatarPx.value * 0.03)))

// sqrt scale keeps sparkles from getting oversized on large avatars
const wBase = computed(() => 2 + Math.sqrt(avatarPx.value) * 0.5)

function sparkleCounts(size: number): { cw: number; ccw: number } {
  if (size < 40) return { cw: 4, ccw: 0 }
  if (size < 64) return { cw: 5, ccw: 2 }
  if (size < 100) return { cw: 7, ccw: 3 }
  if (size < 160) return { cw: 8, ccw: 3 }
  return { cw: 9, ccw: 4 }
}

const counts = computed(() => sparkleCounts(avatarPx.value))

function materialise(templates: typeof CW_TEMPLATES, count: number) {
  return templates.slice(0, count).map((t) => ({
    x: t.x, y: t.y, tone: t.tone, dur: t.dur, delay: t.delay,
    w: Math.max(3, Math.round(wBase.value * t.wMul)),
  }))
}

const cwSparkles = computed(() => materialise(CW_TEMPLATES, counts.value.cw))
const ccwSparkles = computed(() => materialise(CCW_TEMPLATES, counts.value.ccw))
</script>

<style scoped>
@keyframes founder-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: founder-fade-in 0.4s ease-out;
}

.founder-ring__glow {
  position: absolute;
  inset: -12%;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.2);
  filter: blur(12px);
  animation: founder-pulse 4s ease-in-out infinite;
}

.founder-ring__border {
  position: absolute;
  /* inset set via inline style to -borderWidth */
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
  inset: -20%;
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

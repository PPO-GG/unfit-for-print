<script lang="ts" setup>
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(MotionPathPlugin);

const props = defineProps<{
  from: { x: number; y: number };
  to: { x: number; y: number };
}>();

const emit = defineEmits<{
  (e: "done"): void;
}>();

const badgeRef = ref<HTMLElement | null>(null);

onMounted(() => {
  if (!badgeRef.value) return;

  const startX = props.from.x;
  const startY = props.from.y;
  const endX = props.to.x;
  const endY = props.to.y;

  const cpX = (startX + endX) / 2;
  const cpY = Math.min(startY, endY) - 100;

  gsap.set(badgeRef.value, {
    x: startX - 16,
    y: startY - 16,
    scale: 0,
    opacity: 0,
  });

  const tl = gsap.timeline({
    onComplete: () => emit("done"),
  });

  tl.to(badgeRef.value, {
    scale: 1.3,
    opacity: 1,
    duration: 0.2,
    ease: "back.out(3)",
  });

  tl.to(badgeRef.value, {
    motionPath: {
      path: [
        { x: startX - 16, y: startY - 16 },
        { x: cpX - 16, y: cpY - 16 },
        { x: endX - 16, y: endY - 16 },
      ],
      type: "quadratic",
    },
    scale: 0.8,
    duration: 0.6,
    ease: "power2.inOut",
  });

  tl.to(badgeRef.value, {
    scale: 0,
    opacity: 0,
    duration: 0.15,
    ease: "power2.in",
  });
});
</script>

<template>
  <Teleport to="body">
    <div ref="badgeRef" class="score-fly-badge">+1</div>
  </Teleport>
</template>

<style scoped>
.score-fly-badge {
  position: fixed;
  left: 0;
  top: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #eab308, #f59e0b);
  color: #1e1b4b;
  font-size: 0.85rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 9999;
  box-shadow: 0 0 12px rgba(234, 179, 8, 0.5);
}
</style>

<script setup lang="ts">
/**
 * The big editable preview. The avatar is fixed at STAGE_PX so screen
 * pixels convert to avatar diameters with one division. Only image and
 * Lottie layers have a transform, so only they get handles; everything
 * else is edited in the inspector.
 */
import { computed, ref } from "vue";
import { isTransformable, type DecorationLayers, type Transform } from "#shared/decorationLayers";
import DecorationStack from "~/components/decorations/DecorationStack.vue";
import { transformStyle } from "~/utils/decorationRender";
import {
  hitTest, moveTransform, rotationFromPointer, scaleFromPointer, type Point,
} from "~/utils/decorationStageMath";
import AdminDecoSampleAvatar from "./AdminDecoSampleAvatar.vue";

const STAGE_PX = 200;

const props = defineProps<{
  stack: DecorationLayers;
  selectedId: string | null;
  background: "dark" | "light" | "checker";
  sample: "photo" | "initials";
}>();
const emit = defineEmits<{ select: [string]; update: [string, Record<string, unknown>] }>();

const stageEl = ref<HTMLElement | null>(null);

const selected = computed(() => {
  const layer = props.stack.layers.find((l) => l.id === props.selectedId);
  return layer && isTransformable(layer) && layer.visible ? layer : null;
});
const boxStyle = computed(() => (selected.value ? transformStyle(selected.value.transform, STAGE_PX) : null));

const BACKGROUNDS = {
  dark: "bg-slate-950",
  light: "bg-slate-100",
  checker: "deco-stage-checker",
} as const;

function center(): Point {
  const r = stageEl.value!.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

type Mode = "move" | "scale" | "rotate";
let drag: { mode: Mode; startX: number; startY: number; start: Transform } | null = null;
let moved = false;

function start(mode: Mode, e: PointerEvent) {
  if (!selected.value) return;
  drag = { mode, startX: e.clientX, startY: e.clientY, start: { ...selected.value.transform } };
  moved = false;
  try {
    (e.target as Element).setPointerCapture?.(e.pointerId);
  } catch {
    // jsdom (and some browsers for synthetic ids) throw for inactive pointers.
  }
}

function onMove(e: PointerEvent) {
  if (!drag || !selected.value) return;
  const pointer = { x: e.clientX, y: e.clientY };
  const c = center();
  const boxCenter = { x: c.x + drag.start.x * STAGE_PX, y: c.y + drag.start.y * STAGE_PX };
  let transform: Transform;
  if (drag.mode === "move") {
    transform = moveTransform(drag.start, pointer.x - drag.startX, pointer.y - drag.startY, STAGE_PX);
  } else if (drag.mode === "scale") {
    transform = { ...drag.start, scale: scaleFromPointer(boxCenter, pointer, STAGE_PX) };
  } else {
    transform = { ...drag.start, rotation: rotationFromPointer(boxCenter, pointer) };
  }
  moved = true;
  emit("update", selected.value.id, { transform });
}

function onUp() {
  drag = null;
}

function onCancel() {
  drag = null;
  moved = false;
}

function onStageClick(e: MouseEvent) {
  // A drag that ends off the box still fires a click on the stage; that
  // must not reselect whatever is underneath.
  if (moved) {
    moved = false;
    return;
  }
  const id = hitTest(props.stack, { x: e.clientX, y: e.clientY }, center(), STAGE_PX);
  if (id) emit("select", id);
}
</script>

<template>
  <div
    ref="stageEl"
    data-testid="stage"
    class="relative flex aspect-square w-full max-w-[520px] select-none items-center justify-center overflow-hidden rounded-xl"
    :class="BACKGROUNDS[background]"
    @click="onStageClick"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onCancel"
  >
    <DecorationStack :layers="stack">
      <AdminDecoSampleAvatar :size="STAGE_PX" :sample="sample" />
    </DecorationStack>

    <div
      v-if="boxStyle"
      data-testid="handle-box"
      class="absolute z-10 cursor-move border border-dashed border-primary-400"
      :style="boxStyle"
      @pointerdown.stop="start('move', $event)"
      @click.stop
    >
      <div
        data-testid="handle-scale"
        class="absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize border border-primary-400 bg-slate-900"
        @pointerdown.stop="start('scale', $event)"
      />
      <div
        data-testid="handle-rotate"
        class="absolute -top-6 left-1/2 size-3 -translate-x-1/2 cursor-grab rounded-full border border-primary-400 bg-slate-900"
        @pointerdown.stop="start('rotate', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.deco-stage-checker {
  background-color: #cbd5e1;
  background-image:
    linear-gradient(45deg, #94a3b8 25%, transparent 25%),
    linear-gradient(-45deg, #94a3b8 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #94a3b8 75%),
    linear-gradient(-45deg, transparent 75%, #94a3b8 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}
</style>

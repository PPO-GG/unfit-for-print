<script setup lang="ts">
/**
 * Generic inspector: renders FIELDS[layer.type] plus COMMON_FIELDS. Every
 * change is emitted as a patch; the studio composable applies it (and
 * normalises), so this component never mutates the layer it's given.
 */
import { computed } from "vue";
import { HEX_COLOR, type Layer, type RingFill, type Transform } from "#shared/decorationLayers";
import { SNAP_POINTS } from "~/utils/decorationStageMath";
import {
  COMMON_FIELDS, FIELDS, LAYER_LABELS, fromDisplay, mergeRgb, toDisplay, type FieldDef,
} from "~/utils/decorationFields";

const props = defineProps<{ layer: Layer | null; uploading?: boolean }>();
const emit = defineEmits<{ update: [Record<string, unknown>]; upload: [File] }>();

const fields = computed(() =>
  props.layer
    ? [...FIELDS[props.layer.type], ...COMMON_FIELDS].filter((f) => !f.when || f.when(props.layer!))
    : [],
);
const value = (key: string) => (props.layer as unknown as Record<string, unknown>)[key];
const patch = (key: string, v: unknown) => emit("update", { [key]: v });

function setColor(key: string, v: string) {
  if (HEX_COLOR.test(v)) patch(key, v);
}
function setListColor(key: string, index: number, v: string) {
  if (!HEX_COLOR.test(v)) return;
  const list = [...(value(key) as string[])];
  list[index] = v;
  patch(key, list);
}
function addListColor(key: string) {
  const list = value(key) as string[];
  patch(key, [...list, list.at(-1) ?? "#ffffff"]);
}
function removeListColor(key: string, index: number) {
  patch(key, (value(key) as string[]).filter((_, i) => i !== index));
}

const fill = computed(() => value("fill") as RingFill | undefined);
function setFill(next: Partial<RingFill> & { kind?: RingFill["kind"] }) {
  const current = fill.value!;
  if (next.kind === "solid") return patch("fill", { kind: "solid", color: current.kind === "solid" ? current.color : current.stops[0] });
  if (next.kind && current.kind === "solid") return patch("fill", { kind: next.kind, stops: [current.color, "#ffffff"], angle: 0 });
  patch("fill", { ...current, ...next });
}

const transform = computed(() => value("transform") as Transform | undefined);
const TRANSFORM_KEYS = [
  { key: "x", label: "X", min: -1.5, max: 1.5, step: 0.01, boxMax: 1.5 },
  { key: "y", label: "Y", min: -1.5, max: 1.5, step: 0.01, boxMax: 1.5 },
  { key: "scale", label: "Scale", min: 0.1, max: 4, step: 0.05, boxMax: 8 },
  { key: "rotation", label: "Rotation", min: -180, max: 180, step: 1, boxMax: 180 },
] as const;
function setTransform(next: Partial<Transform>) {
  patch("transform", { ...transform.value!, ...next });
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("upload", file);
  input.value = "";
}

const rangeLabel = (f: FieldDef & { kind: "range" }) =>
  `${toDisplay(f, value(f.key) as number)}${f.percent ? "%" : f.unit}`;
</script>

<template>
  <div v-if="!layer" class="p-4 text-sm text-slate-400">Select a layer to edit it.</div>

  <div v-else class="flex flex-col gap-4 text-sm">
    <div class="flex items-center gap-2">
      <span class="font-semibold">{{ LAYER_LABELS[layer.type] }}</span>
      <UInput
        :model-value="layer.name ?? ''"
        size="xs"
        placeholder="Layer name"
        class="flex-1"
        @update:model-value="patch('name', $event)"
      />
    </div>

    <template v-for="f in fields" :key="f.key">
      <!-- range -->
      <div v-if="f.kind === 'range'" :data-testid="`field-${f.key}`" class="flex flex-col gap-1">
        <label class="flex justify-between text-xs text-slate-400">{{ f.label }}<span>{{ rangeLabel(f) }}</span></label>
        <div class="flex items-center gap-2">
          <USlider
            class="flex-1"
            :model-value="toDisplay(f, value(f.key) as number)"
            :min="toDisplay(f, f.min)"
            :max="toDisplay(f, f.max)"
            :step="toDisplay(f, f.step)"
            @update:model-value="patch(f.key, fromDisplay(f, Number($event)))"
          />
          <UInputNumber
            class="w-20"
            size="xs"
            :model-value="toDisplay(f, value(f.key) as number)"
            :min="toDisplay(f, f.min)"
            :max="toDisplay(f, f.max)"
            :step="toDisplay(f, f.step)"
            @update:model-value="patch(f.key, fromDisplay(f, Number($event)))"
          />
        </div>
      </div>

      <!-- select -->
      <div v-else-if="f.kind === 'select'" :data-testid="`field-${f.key}`" class="flex flex-col gap-1">
        <label class="text-xs text-slate-400">{{ f.label }}</label>
        <USelect size="xs" :items="f.options" :model-value="value(f.key) as string" @update:model-value="patch(f.key, $event)" />
      </div>

      <!-- toggle -->
      <div v-else-if="f.kind === 'toggle'" :data-testid="`field-${f.key}`" class="flex items-center gap-2">
        <USwitch :model-value="value(f.key) as boolean" @update:model-value="patch(f.key, $event)" />
        <span>{{ f.label }}</span>
      </div>

      <!-- single colour -->
      <div v-else-if="f.kind === 'color'" :data-testid="`field-${f.key}`" class="flex flex-col gap-1">
        <label class="text-xs text-slate-400">{{ f.label }}</label>
        <div class="flex items-center gap-2">
          <input
            type="color"
            class="h-7 w-9 cursor-pointer rounded bg-transparent"
            :value="(value(f.key) as string).slice(0, 7)"
            @input="setColor(f.key, mergeRgb(value(f.key) as string, ($event.target as HTMLInputElement).value))"
          />
          <UInput size="xs" class="flex-1 font-mono" :model-value="value(f.key) as string" @update:model-value="setColor(f.key, String($event))" />
        </div>
      </div>

      <!-- colour list -->
      <div v-else-if="f.kind === 'colors'" :data-testid="`field-${f.key}`" class="flex flex-col gap-1">
        <label class="text-xs text-slate-400">{{ f.label }}</label>
        <div class="flex flex-wrap items-center gap-1">
          <div v-for="(c, i) in (value(f.key) as string[])" :key="i" class="flex items-center">
            <input type="color" class="h-7 w-8 cursor-pointer rounded bg-transparent" :value="c.slice(0, 7)"
              @input="setListColor(f.key, i, mergeRgb(c, ($event.target as HTMLInputElement).value))" />
            <UButton v-if="(value(f.key) as string[]).length > f.min" size="xs" variant="ghost" color="neutral" icon="i-lucide-x" aria-label="Remove colour" @click="removeListColor(f.key, i)" />
          </div>
          <UButton v-if="(value(f.key) as string[]).length < f.max" size="xs" variant="soft" color="neutral" icon="i-lucide-plus" aria-label="Add colour" @click="addListColor(f.key)" />
        </div>
      </div>

      <!-- ring fill -->
      <div v-else-if="f.kind === 'fill' && fill" :data-testid="`field-${f.key}`" class="flex flex-col gap-2">
        <label class="text-xs text-slate-400">{{ f.label }}</label>
        <USelect size="xs" :items="[{ label: 'Solid', value: 'solid' }, { label: 'Conic', value: 'conic' }, { label: 'Linear', value: 'linear' }]"
          :model-value="fill.kind" @update:model-value="setFill({ kind: $event as RingFill['kind'] })" />
        <div v-if="fill.kind === 'solid'" class="flex items-center gap-2">
          <input type="color" class="h-7 w-9 cursor-pointer rounded bg-transparent" :value="fill.color.slice(0, 7)"
            @input="setFill({ color: mergeRgb(fill.color, ($event.target as HTMLInputElement).value) } as never)" />
          <span class="font-mono text-xs">{{ fill.color }}</span>
        </div>
        <template v-else>
          <div class="flex flex-wrap items-center gap-1">
            <div v-for="(c, i) in fill.stops" :key="i" class="flex items-center">
              <input type="color" class="h-7 w-8 cursor-pointer rounded bg-transparent" :value="c.slice(0, 7)"
                @input="setFill({ stops: fill.stops.map((s, j) => (j === i ? mergeRgb(s, ($event.target as HTMLInputElement).value) : s)) } as never)" />
              <UButton v-if="fill.stops.length > 2" size="xs" variant="ghost" color="neutral" icon="i-lucide-x" aria-label="Remove stop"
                @click="setFill({ stops: fill.stops.filter((_, j) => j !== i) } as never)" />
            </div>
            <UButton v-if="fill.stops.length < 6" size="xs" variant="soft" color="neutral" icon="i-lucide-plus" aria-label="Add stop"
              @click="setFill({ stops: [...fill.stops, fill.stops.at(-1)!] } as never)" />
          </div>
          <label class="flex justify-between text-xs text-slate-400">Angle<span>{{ fill.angle }}°</span></label>
          <USlider :model-value="fill.angle" :min="0" :max="360" :step="1" @update:model-value="setFill({ angle: Number($event) } as never)" />
        </template>
      </div>

      <!-- asset -->
      <div v-else-if="f.kind === 'asset'" :data-testid="`field-${f.key}`" class="flex flex-col gap-1">
        <label class="text-xs text-slate-400">{{ f.label }}</label>
        <div class="flex items-center gap-2">
          <UBadge v-if="value('asset')" size="sm" variant="subtle" color="neutral">{{ (value("asset") as { format: string }).format }}</UBadge>
          <span class="flex-1 truncate font-mono text-xs text-slate-400">
            {{ (value("asset") as { key: string } | null)?.key ?? "No file yet" }}
          </span>
        </div>
        <div class="flex gap-2">
          <label class="cursor-pointer">
            <input data-testid="asset-input" type="file" class="hidden" :accept="f.accept" @change="onFile" />
            <span class="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700">
              <UIcon :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-upload'" :class="{ 'animate-spin': uploading }" />
              {{ value("asset") ? "Replace" : "Upload" }}
            </span>
          </label>
          <UButton v-if="value('asset')" size="xs" variant="ghost" color="error" @click="patch('asset', null)">Remove</UButton>
        </div>
      </div>

      <!-- transform -->
      <div v-else-if="f.kind === 'transform' && transform" :data-testid="`field-${f.key}`" class="flex flex-col gap-2">
        <label class="text-xs text-slate-400">{{ f.label }}</label>
        <div class="flex flex-wrap gap-1">
          <UButton v-for="(point, name) in SNAP_POINTS" :key="name" :data-testid="`snap-${name}`" size="xs" variant="soft" color="neutral"
            @click="setTransform({ ...point })">{{ name }}</UButton>
        </div>
        <div v-for="t in TRANSFORM_KEYS" :key="t.key" :data-testid="`field-transform-${t.key}`" class="flex items-center gap-2">
          <span class="w-14 text-xs text-slate-400">{{ t.label }}</span>
          <USlider class="flex-1" :model-value="transform[t.key]" :min="t.min" :max="t.max" :step="t.step"
            @update:model-value="setTransform({ [t.key]: Number($event) })" />
          <UInputNumber class="w-20" size="xs" :model-value="transform[t.key]" :min="t.min" :max="t.boxMax" :step="t.step"
            @update:model-value="setTransform({ [t.key]: Number($event) })" />
        </div>
      </div>
    </template>
  </div>
</template>

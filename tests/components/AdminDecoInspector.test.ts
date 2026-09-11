import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminDecoInspector from "~/components/admin/AdminDecoInspector.vue";
import { createLayer } from "#shared/decorationLayers";

const stubs = {
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  UIcon: { template: "<i />" },
  UBadge: { template: "<span><slot /></span>" },
  USwitch: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" />`,
  },
  // min/max/step must be bound: jsdom sanitises range values to the step grid
  // (default 0–100 by 1), which would turn 0.25 into 0.
  USlider: {
    props: ["modelValue", "min", "max", "step"],
    emits: ["update:modelValue"],
    template: `<input type="range" :min="min" :max="max" :step="step" :value="modelValue" @input="$emit('update:modelValue', Number($event.target.value))" />`,
  },
  UInputNumber: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input type="number" :value="modelValue" @change="$emit('update:modelValue', Number($event.target.value))" />`,
  },
  USelect: {
    props: ["modelValue", "items"],
    emits: ["update:modelValue"],
    template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option v-for="i in items" :key="i.value" :value="i.value">{{ i.label }}</option></select>`,
  },
  UInput: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
};
const mountFor = (layer: object) => mount(AdminDecoInspector, { props: { layer }, global: { stubs } });

describe("AdminDecoInspector", () => {
  it("renders the type's fields plus the common ones", () => {
    const w = mountFor(createLayer("glow"));
    for (const key of ["color", "spread", "softness", "animation", "duration", "opacity", "blend", "side", "clip"]) {
      expect(w.find(`[data-testid="field-${key}"]`).exists(), key).toBe(true);
    }
  });

  it("emits fractions for percent sliders", async () => {
    const w = mountFor(createLayer("glow"));
    await w.find('[data-testid="field-spread"] input[type="range"]').setValue("30");
    expect(w.emitted("update")?.at(-1)).toEqual([{ spread: 0.3 }]);
  });

  it("merges transform edits and snaps to the avatar edge", async () => {
    const w = mountFor(createLayer("image"));
    await w.find('[data-testid="field-transform-x"] input[type="range"]').setValue("0.25");
    expect(w.emitted("update")?.at(-1)).toEqual([{ transform: { x: 0.25, y: -0.5, scale: 0.6, rotation: 0 } }]);
    await w.find('[data-testid="snap-top-left"]').trigger("click");
    expect(w.emitted("update")?.at(-1)).toEqual([{ transform: { x: -0.5, y: -0.5, scale: 0.6, rotation: 0 } }]);
  });

  it("hides the particle upload until the shape is image", () => {
    expect(mountFor(createLayer("particles")).find('[data-testid="field-asset"]').exists()).toBe(false);
    expect(mountFor({ ...createLayer("particles"), shape: "image" }).find('[data-testid="field-asset"]').exists()).toBe(true);
  });

  it("emits upload with the chosen file", async () => {
    const w = mountFor(createLayer("image"));
    const input = w.find('[data-testid="asset-input"]');
    const file = new File(["x"], "hat.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file] });
    await input.trigger("change");
    expect(w.emitted("upload")?.[0]).toEqual([file]);
  });

  it("ignores an invalid hex colour instead of emitting it", async () => {
    const w = mountFor(createLayer("glow"));
    await w.find('[data-testid="field-color"] input:not([type="color"])').setValue("red");
    expect(w.emitted("update")).toBeUndefined();
    await w.find('[data-testid="field-color"] input:not([type="color"])').setValue("#ff0000");
    expect(w.emitted("update")?.at(-1)).toEqual([{ color: "#ff0000" }]);
  });

  it("shows an empty state with no layer selected", () => {
    const w = mount(AdminDecoInspector, { props: { layer: null }, global: { stubs } });
    expect(w.text()).toMatch(/select a layer/i);
  });
});

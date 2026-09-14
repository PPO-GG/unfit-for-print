import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminCardForm from "~/components/admin/AdminCardForm.vue";
import type { AdminCard } from "~/types/adminCard";

const stubs = {
  UTextarea: { props: ["modelValue"], emits: ["update:modelValue"], template: `<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />` },
  UInput: { props: ["modelValue"], emits: ["update:modelValue"], template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />` },
  UButton: { props: ["disabled"], template: "<button :disabled='disabled' v-bind='$attrs'><slot /></button>" },
  UFormField: { props: ["label"], template: "<div><label>{{ label }}</label><slot /></div>" },
  AdminPackPicker: { props: ["modelValue", "packs"], emits: ["update:modelValue"], template: "<div class='picker'></div>" },
};

const white: AdminCard = { id: "w1", text: "A card.", type: "white", packId: "p1", pack: "Base", active: true };
const black: AdminCard = { id: "b1", text: "Why? _", type: "black", packId: "p1", pack: "Base", active: true, pick: 1 };

type FormVm = { draft: { text: string; pick: number; pack: string }; dirty: boolean; save: () => void; revert: () => void };
const mountForm = (card: AdminCard = white, extra = {}) =>
  mount(AdminCardForm, { props: { card, packs: ["Base", "Blue"], ...extra }, global: { stubs } });
const vmOf = (w: ReturnType<typeof mountForm>) => w.vm as unknown as FormVm;

describe("AdminCardForm", () => {
  it("seeds a clean draft from the card", () => {
    const vm = vmOf(mountForm());
    expect(vm.draft.text).toBe("A card.");
    expect(vm.dirty).toBe(false);
  });

  it("does not save while clean, and never on blur", async () => {
    const w = mountForm();
    await w.get("textarea").trigger("blur");
    vmOf(w).save();
    expect(w.emitted("save")).toBeUndefined();
  });

  it("emits the edit on save, with pack only when it changed", async () => {
    const w = mountForm();
    vmOf(w).draft.text = "Edited.";
    vmOf(w).save();
    vmOf(w).draft.pack = "Blue";
    vmOf(w).save();
    expect(w.emitted("save")).toEqual([
      [{ text: "Edited.", pick: undefined, pack: undefined }],
      [{ text: "Edited.", pick: undefined, pack: "Blue" }],
    ]);
  });

  it("saves with Ctrl+Enter", async () => {
    const w = mountForm();
    vmOf(w).draft.text = "Edited.";
    await w.get("textarea").trigger("keydown", { key: "Enter", ctrlKey: true });
    expect(w.emitted("save")).toHaveLength(1);
  });

  it("includes pick for black cards and refuses empty text", async () => {
    const w = mountForm(black);
    vmOf(w).draft.pick = 2;
    vmOf(w).save();
    expect(w.emitted("save")?.[0]).toEqual([{ text: "Why? _", pick: 2, pack: undefined }]);

    const t = mountForm();
    vmOf(t).draft.text = "   ";
    vmOf(t).save();
    expect(t.emitted("save")).toBeUndefined();
  });

  it("reverts to the card", () => {
    const w = mountForm();
    vmOf(w).draft.text = "changed";
    vmOf(w).revert();
    expect(vmOf(w).draft.text).toBe("A card.");
    expect(vmOf(w).dirty).toBe(false);
  });

  it("re-seeds for another card or a clean reload, but keeps a dirty draft", async () => {
    const w = mountForm();
    await w.setProps({ card: { ...white, text: "Reloaded." } });
    expect(vmOf(w).draft.text).toBe("Reloaded.");

    vmOf(w).draft.text = "mine";
    await w.setProps({ card: { ...white, text: "Reloaded again." } });
    expect(vmOf(w).draft.text).toBe("mine");

    await w.setProps({ card: { ...white, id: "w2", text: "Other." } });
    expect(vmOf(w).draft.text).toBe("Other.");
  });

  it("labels the enable action by current state", () => {
    expect(mountForm().text()).toContain("Disable");
    expect(mountForm({ ...white, active: false }).text()).toContain("Enable");
  });
});

describe("AdminCardForm — image cards", () => {
  const image: AdminCard = { ...black, text: null, imageKey: "abc", imageFormat: "png" };

  it("shows the image instead of a text field and can still save a pick", () => {
    const w = mountForm(image);
    expect(w.find("[data-testid='card-image']").exists()).toBe(true);
    expect(w.find("textarea").exists()).toBe(false);
    vmOf(w).draft.pick = 3;
    vmOf(w).save();
    expect(w.emitted("save")?.[0]).toEqual([{ text: "", pick: 3, pack: undefined }]);
  });
});

describe("AdminCardForm — performance", () => {
  it("shows counters and the rate once there are enough plays", () => {
    const w = mountForm({ ...white, timesPlayed: 200, timesWon: 20 });
    expect(w.text()).toContain("200");
    expect(w.text()).toContain("10.0%");
  });

  it("says so below the play threshold", () => {
    expect(mountForm({ ...white, timesPlayed: 2, timesWon: 1 }).text()).toContain("Not enough plays");
  });
});

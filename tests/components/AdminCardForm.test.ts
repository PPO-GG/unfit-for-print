import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminCardForm from "~/components/admin/AdminCardForm.vue";

const stubs = {
  UTextarea: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
  UInput: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
  UButton: { template: "<button><slot /></button>" },
  UFormField: { props: ["label"], template: "<div><label>{{ label }}</label><slot /></div>" },
  AdminPackPicker: { props: ["modelValue", "packs"], template: "<div class='picker'></div>" },
};

const white = { id: "w1", text: "A card.", type: "white" as const, pack: "Base", active: true };
const black = { id: "b1", text: "Why? _", type: "black" as const, pack: "Base", active: true, pick: 1 };

const mountForm = (card = white) =>
  mount(AdminCardForm, { props: { card, packs: ["Base", "Blue"] }, global: { stubs } });

describe("AdminCardForm", () => {
  it("seeds the draft from the card", () => {
    expect(mountForm().vm.draft.text).toBe("A card.");
  });

  it("re-seeds when a different card is inspected", async () => {
    const wrapper = mountForm();
    wrapper.vm.draft.text = "edited but not saved";
    await wrapper.setProps({ card: { ...white, id: "w2", text: "Another." } });
    expect(wrapper.vm.draft.text).toBe("Another.");
  });

  it("emits save with the edited text", async () => {
    const wrapper = mountForm();
    wrapper.vm.draft.text = "Edited.";
    await wrapper.vm.save();
    expect(wrapper.emitted("save")?.at(-1)).toEqual([{ text: "Edited.", pick: undefined }]);
  });

  it("includes pick for black cards only", async () => {
    const wrapper = mountForm(black);
    wrapper.vm.draft.pick = 2;
    await wrapper.vm.save();
    expect(wrapper.emitted("save")?.at(-1)).toEqual([{ text: "Why? _", pick: 2 }]);
  });

  it("does not save an empty text", async () => {
    const wrapper = mountForm();
    wrapper.vm.draft.text = "   ";
    await wrapper.vm.save();
    expect(wrapper.emitted("save")).toBeUndefined();
  });

  it("labels the deactivate action by current state", () => {
    expect(mountForm().text()).toContain("Deactivate");
    expect(mountForm({ ...white, active: false }).text()).toContain("Activate");
  });

  it("does not save when nothing changed", async () => {
    const wrapper = mountForm();
    await wrapper.vm.save();
    expect(wrapper.emitted("save")).toBeUndefined();
  });

  it("saves once when the same edit is committed twice", async () => {
    const wrapper = mountForm();
    wrapper.vm.draft.text = "Edited.";
    await wrapper.vm.save(); // Ctrl+Enter
    await wrapper.setProps({ card: { ...white, text: "Edited." } }); // Parent updates the card
    await wrapper.vm.save(); // the blur that follows
    expect(wrapper.emitted("save")).toHaveLength(1);
  });

  it("saves again once the card prop catches up and the text changes again", async () => {
    const wrapper = mountForm();
    wrapper.vm.draft.text = "Edited.";
    await wrapper.vm.save();
    await wrapper.setProps({ card: { ...white, text: "Edited." } });
    wrapper.vm.draft.text = "Edited twice.";
    await wrapper.vm.save();
    expect(wrapper.emitted("save")).toHaveLength(2);
  });

  it("still saves a changed pick on a black card", async () => {
    const wrapper = mountForm(black);
    wrapper.vm.draft.pick = 2;
    await wrapper.vm.save();
    expect(wrapper.emitted("save")?.at(-1)).toEqual([{ text: "Why? _", pick: 2 }]);
  });
});

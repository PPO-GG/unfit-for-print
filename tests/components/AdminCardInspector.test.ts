// One panel, three states. Which one shows is decided only by the selection —
// getting that wrong is how the panel ends up blank mid-operation.
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AdminCardInspector from "~/components/admin/AdminCardInspector.vue";

const stubs = {
  AdminCardForm: { props: ["card", "packs"], template: "<div class='card-form' />" },
  AdminPackForm: {
    props: ["pack", "meta"],
    emits: ["saved"],
    template: "<div class='pack-form' />",
  },
  UButton: { template: "<button><slot /></button>" },
};

const card = { id: "w1", text: "A card.", type: "white" as const, pack: "Base", active: true };

const mountInspector = (props = {}) =>
  mount(AdminCardInspector, {
    props: { card: null, selectedCount: 0, packs: ["Base"], ...props },
    global: { stubs },
  });

describe("AdminCardInspector", () => {
  it("shows the pack state when nothing is selected", async () => {
    const meta = { pack: "Base", displayName: "Base Set" };
    const wrapper = mountInspector({ packName: "Base", packMeta: meta });
    expect(wrapper.find('[data-testid="state-pack"]').exists()).toBe(true);
    expect(wrapper.find(".card-form").exists()).toBe(false);

    const packForm = wrapper.findComponent(stubs.AdminPackForm);
    expect(packForm.exists()).toBe(true);
    expect(packForm.props("pack")).toBe("Base");
    expect(packForm.props("meta")).toEqual(meta);

    await packForm.vm.$emit("saved", meta);
    expect(wrapper.emitted("pack-saved")?.at(-1)).toEqual([meta]);
  });

  it("shows the card editor for a single inspected card", () => {
    const wrapper = mountInspector({ card, selectedCount: 0 });
    expect(wrapper.find(".card-form").exists()).toBe(true);
  });

  it("shows the bulk summary when several are selected, even with one inspected", () => {
    const wrapper = mountInspector({ card, selectedCount: 4 });
    expect(wrapper.find('[data-testid="state-bulk"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("4");
    expect(wrapper.find(".card-form").exists()).toBe(false);
  });

  it("still shows the card editor when exactly one is selected", () => {
    const wrapper = mountInspector({ card, selectedCount: 1 });
    expect(wrapper.find(".card-form").exists()).toBe(true);
  });

  it("prompts to pick a card when browsing across packs with nothing inspected", () => {
    const wrapper = mountInspector({ packName: undefined });
    expect(wrapper.text()).toMatch(/select a card/i);
  });
});

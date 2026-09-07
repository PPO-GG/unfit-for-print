import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));

import AdminPackDetailsModal from "~/components/admin/AdminPackDetailsModal.vue";

const stubs = {
  UModal: { template: "<div><slot /><slot name='body' /><slot name='footer' /></div>" },
  UFormField: { props: ["label"], template: "<div><label>{{ label }}</label><slot /></div>" },
  UInput: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
  UTextarea: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
  USwitch: { props: ["modelValue", "label"], emits: ["update:modelValue"], template: "<input type='checkbox' />" },
  UButton: { template: "<button><slot /></button>" },
};

function mountModal(meta: Record<string, unknown> | null = null) {
  return mount(AdminPackDetailsModal, {
    props: { open: true, pack: "Base", meta: meta as never },
    global: { stubs },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("AdminPackDetailsModal", () => {
  it("starts from empty defaults when the pack has no metadata row", () => {
    const wrapper = mountModal(null);
    expect(wrapper.vm.form).toEqual({
      displayName: "",
      description: "",
      icon: "",
      color: "",
      sortOrder: 0,
      official: false,
      nsfw: false,
    });
  });

  it("seeds the form from an existing metadata row", () => {
    const wrapper = mountModal({
      pack: "Base",
      displayName: "Base Set",
      description: "the original",
      icon: "🎴",
      color: "#f00",
      sortOrder: 3,
      official: true,
      nsfw: false,
    });
    expect(wrapper.vm.form.displayName).toBe("Base Set");
    expect(wrapper.vm.form.sortOrder).toBe(3);
    expect(wrapper.vm.form.official).toBe(true);
  });

  it("posts the form, sending empty strings as null", async () => {
    fetchMock.mockResolvedValue({ pack: "Base", displayName: null });
    const wrapper = mountModal(null);
    wrapper.vm.form.description = "a blurb";

    await wrapper.vm.save();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/cards/pack-meta", {
      method: "POST",
      body: {
        pack: "Base",
        displayName: null,
        description: "a blurb",
        icon: null,
        color: null,
        sortOrder: 0,
        official: false,
        nsfw: false,
      },
    });
  });

  it("emits the saved row and closes on success", async () => {
    const saved = { pack: "Base", displayName: "Base Set" };
    fetchMock.mockResolvedValue(saved);
    const wrapper = mountModal(null);

    await wrapper.vm.save();
    await flushPromises();

    expect(wrapper.emitted("saved")?.at(-1)).toEqual([saved]);
    expect(wrapper.emitted("update:open")?.at(-1)).toEqual([false]);
  });

  it("stays open when the save fails", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    const wrapper = mountModal(null);

    await wrapper.vm.save();
    await flushPromises();

    expect(wrapper.emitted("saved")).toBeUndefined();
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });
});

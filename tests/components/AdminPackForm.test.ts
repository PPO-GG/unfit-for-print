import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));

import AdminPackForm from "~/components/admin/AdminPackForm.vue";

const stubs = {
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

function mountForm(meta: Record<string, unknown> | null = null, extra: Record<string, unknown> = {}) {
  return mount(AdminPackForm, {
    props: { pack: "Base", meta: meta as never, ...extra },
    global: { stubs },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("AdminPackForm", () => {
  it("starts from empty defaults when the pack has no metadata row", () => {
    const wrapper = mountForm(null);
    expect(wrapper.vm.form).toEqual({
      displayName: "",
      description: "",
      icon: "",
      color: "",
      series: "",
      sortOrder: 0,
      official: false,
      nsfw: false,
    });
  });

  it("seeds the form from an existing metadata row", () => {
    const wrapper = mountForm({
      pack: "Base",
      displayName: "Base Set",
      description: "the original",
      icon: "🎴",
      color: "#f00",
      series: "Cards Against Humanity",
      sortOrder: 3,
      official: true,
      nsfw: false,
    });
    expect(wrapper.vm.form.displayName).toBe("Base Set");
    expect(wrapper.vm.form.series).toBe("Cards Against Humanity");
    expect(wrapper.vm.form.sortOrder).toBe(3);
    expect(wrapper.vm.form.official).toBe(true);
  });

  it("posts the form, sending empty strings as null", async () => {
    fetchMock.mockResolvedValue({ pack: "Base", displayName: null });
    const wrapper = mountForm(null);
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
        series: null,
        sortOrder: 0,
        official: false,
        nsfw: false,
      },
    });
  });

  it("autofills display name and series from the derived split when the pack has no metadata", () => {
    const wrapper = mount(AdminPackForm, {
      props: {
        pack: "Cards Against Humanity: Blue Box Expansion",
        meta: null,
        seriesPrefix: "Cards Against Humanity:",
      },
      global: { stubs },
    });
    expect(wrapper.vm.form.displayName).toBe("Blue Box Expansion");
    expect(wrapper.vm.form.series).toBe("Cards Against Humanity");
  });

  it("does not autofill a display name when the pack name never splits", () => {
    // No seriesPrefix at all — splitPackName has nothing to derive, so
    // suggesting the raw pack name back as a "display name" would be a no-op.
    const wrapper = mountForm(null);
    expect(wrapper.vm.form.displayName).toBe("");
    expect(wrapper.vm.form.series).toBe("");
  });

  it("prefers an explicit metadata value over the derived autofill", () => {
    const wrapper = mount(AdminPackForm, {
      props: {
        pack: "Cards Against Humanity: Blue Box Expansion",
        meta: { pack: "x", displayName: "The Blue One", series: "CAH" },
        seriesPrefix: "Cards Against Humanity:",
      },
      global: { stubs },
    });
    expect(wrapper.vm.form.displayName).toBe("The Blue One");
    expect(wrapper.vm.form.series).toBe("CAH");
  });

  it("sends the series field, trimmed", async () => {
    fetchMock.mockResolvedValue({ pack: "Base", series: "Cards Against Humanity" });
    const wrapper = mountForm(null);
    wrapper.vm.form.series = "  Cards Against Humanity  ";

    await wrapper.vm.save();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/cards/pack-meta",
      expect.objectContaining({ body: expect.objectContaining({ series: "Cards Against Humanity" }) }),
    );
  });

  it("emits the saved row on success", async () => {
    const saved = { pack: "Base", displayName: "Base Set" };
    fetchMock.mockResolvedValue(saved);
    const wrapper = mountForm(null);

    await wrapper.vm.save();
    await flushPromises();

    expect(wrapper.emitted("saved")?.at(-1)).toEqual([saved]);
  });

  it("does not emit saved when the save fails", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    const wrapper = mountForm(null);

    await wrapper.vm.save();
    await flushPromises();

    expect(wrapper.emitted("saved")).toBeUndefined();
  });

  it("saves when the in-form Save button is clicked", async () => {
    const saved = { pack: "Base", displayName: "Base Set" };
    fetchMock.mockResolvedValue(saved);
    const wrapper = mountForm(null);

    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/cards/pack-meta",
      expect.objectContaining({ method: "POST" }),
    );
    expect(wrapper.emitted("saved")?.at(-1)).toEqual([saved]);
  });
});

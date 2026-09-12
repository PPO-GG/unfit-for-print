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

// Pack metadata is rendered by five surfaces that all uppercase in CSS, which
// hides exactly the defects a hand-typed field picks up. Two real rows carried
// them: a series typed "Cards against Humanity", and a pack key with a double
// space the series-prefix derivation could never match.
describe("AdminPackForm — entry hygiene", () => {
  it("collapses internal whitespace and trims before sending", async () => {
    fetchMock.mockResolvedValue({ pack: "Base" });
    const wrapper = mountForm(null);
    wrapper.vm.form.displayName = "  Nasty   Bundle  ";
    wrapper.vm.form.series = "Cards Against  Humanity";

    await wrapper.vm.save();
    await flushPromises();

    expect(fetchMock.mock.calls[0]![1].body).toMatchObject({
      displayName: "Nasty Bundle",
      series: "Cards Against Humanity",
    });
  });

  it("writes the normalized value back into the form", async () => {
    // Saving text that differs from what the box shows is how an admin comes
    // away believing they already fixed something they did not.
    fetchMock.mockResolvedValue({ pack: "Base" });
    const wrapper = mountForm(null);
    wrapper.vm.form.series = "  Cards Against  Humanity ";

    await wrapper.vm.save();
    await flushPromises();

    expect(wrapper.vm.form.series).toBe("Cards Against Humanity");
  });

  it("still sends null for a field that is only whitespace", async () => {
    // The existing contract: blank clears the column rather than storing "".
    fetchMock.mockResolvedValue({ pack: "Base" });
    const wrapper = mountForm(null);
    wrapper.vm.form.displayName = "   ";

    await wrapper.vm.save();
    await flushPromises();

    expect(fetchMock.mock.calls[0]![1].body.displayName).toBeNull();
  });

  it("warns when a name is typed in caps", async () => {
    const wrapper = mountForm(null);
    wrapper.vm.form.series = "CARDS AGAINST HUMANITY";
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="pack-shout-hint"]').exists()).toBe(true);
  });

  it("stays quiet on ordinary title case", async () => {
    const wrapper = mountForm(null);
    wrapper.vm.form.series = "Cards Against Humanity";
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="pack-shout-hint"]').exists()).toBe(false);
  });

  it("stays quiet on a short acronym", async () => {
    // Warning on "CAH" would train the admin to click past the warning.
    const wrapper = mountForm(null);
    wrapper.vm.form.displayName = "CAH";
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="pack-shout-hint"]').exists()).toBe(false);
  });

  it("does not block saving a shouted value", async () => {
    // Advisory only — casing stays the admin's call.
    fetchMock.mockResolvedValue({ pack: "Base" });
    const wrapper = mountForm(null);
    wrapper.vm.form.series = "CARDS AGAINST HUMANITY";

    await wrapper.vm.save();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalled();
    expect(wrapper.emitted("saved")).toBeTruthy();
  });
});


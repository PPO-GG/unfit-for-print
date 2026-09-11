import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { normalizeLayers } from "#shared/decorationLayers";

// AvatarDecoration shares its catalog cache through Nuxt's useState and
// fetches with $fetch; plain vitest has neither.
const states = new Map<string, ReturnType<typeof ref>>();
vi.stubGlobal("useState", (key: string, init: () => unknown) => {
  if (!states.has(key)) states.set(key, ref(init()));
  return states.get(key);
});
const fetchMock = vi.fn();
vi.stubGlobal("$fetch", fetchMock);

import AvatarDecoration from "~/components/decorations/AvatarDecoration.vue";

const stubs = { ClientOnly: { template: "<div><slot /></div>" } };
const slots = { default: '<img class="avatar" src="a.png" />' };
const entry = (id: string, layers: unknown[]) => ({
  $id: id, decorationId: id, name: id, description: "", type: "layered", rarity: "common",
  category: "custom", enabled: true, freeForAll: true, discordSkuId: null, price: 0,
  sortOrder: 0, imageFileId: null, imageFormat: null, attachment: null,
  layers: normalizeLayers({ v: 1, layers }),
});

beforeEach(() => {
  states.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue([]);
});

describe("AvatarDecoration", () => {
  it("passes the avatar through with no decoration id", () => {
    const wrapper = mount(AvatarDecoration, { props: {}, slots, global: { stubs } });
    expect(wrapper.find("img.avatar").exists()).toBe(true);
    expect(wrapper.find(".deco-stack").exists()).toBe(false);
  });

  it("renders the stack from a catalogEntry prop without waiting for the fetch", () => {
    const wrapper = mount(AvatarDecoration, {
      props: { decorationId: "halo", catalogEntry: entry("halo", [{ type: "ring", id: "r" }]) as never },
      slots,
      global: { stubs },
    });
    expect(wrapper.find(".deco-stack").exists()).toBe(true);
    expect(wrapper.find('[data-layer-type="ring"]').exists()).toBe(true);
    expect(wrapper.find("img.avatar").exists()).toBe(true);
  });

  it("falls back to the shared catalog cache, fetched once", async () => {
    fetchMock.mockResolvedValue([entry("halo", [{ type: "glow", id: "g" }])]);
    const a = mount(AvatarDecoration, { props: { decorationId: "halo" }, slots, global: { stubs } });
    mount(AvatarDecoration, { props: { decorationId: "halo" }, slots, global: { stubs } });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/decorations/catalog");
    expect(a.find('[data-layer-type="glow"]').exists()).toBe(true);
  });

  it("passes the avatar through for an unknown id or an empty stack", async () => {
    fetchMock.mockResolvedValue([entry("empty", [])]);
    for (const id of ["nonexistent", "empty"]) {
      const wrapper = mount(AvatarDecoration, { props: { decorationId: id }, slots, global: { stubs } });
      await flushPromises();
      expect(wrapper.find(".deco-stack").exists()).toBe(false);
      expect(wrapper.find("img.avatar").exists()).toBe(true);
    }
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref, onMounted } from "vue";

// The page leans on Nuxt's auto-imports, which plain vitest doesn't provide.
vi.stubGlobal("ref", ref);
vi.stubGlobal("onMounted", onMounted);
vi.stubGlobal("definePageMeta", () => {});
const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));
vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));

import PicksPage from "~/pages/admin/cards/picks.vue";

const stubs = {
  NuxtLink: { template: "<a><slot /></a>" },
  UIcon: { template: "<i />" },
  USkeleton: { template: "<div />" },
  UBadge: { template: "<span><slot /></span>" },
  UFieldGroup: { template: "<div><slot /></div>" },
  UButton: { template: `<button v-bind="$attrs"><slot /></button>` },
};

const cards = [
  { id: "a", text: "___ and ___.", pack: "Base", pick: 1, active: true },
  { id: "b", text: "___ or ___?", pack: "Base", pick: 1, active: true },
  { id: "c", text: "_, _, and _.", pack: "Base", pick: 1, active: true },
  { id: "d", text: "Just ___.", pack: "Base", pick: 1, active: true },
];

const setPickCalls = () =>
  fetchMock.mock.calls
    .filter(([url]) => url === "/api/admin/cards/set-pick")
    .map(([, opts]) => opts.body);

const button = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll("button").find((b) => b.text() === text)!;

async function mountPage() {
  const wrapper = mount(PicksPage, { global: { stubs } });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    url === "/api/admin/cards/list" ? cards : { updated: 1 },
  );
});

describe("admin pick-mismatch page", () => {
  it("lists only the cards whose blanks disagree with their pick", async () => {
    const wrapper = await mountPage();
    expect(wrapper.findAll("li")).toHaveLength(3);
    expect(wrapper.text()).not.toContain("Just");
  });

  it("saves one card's suggestion and drops its row", async () => {
    const wrapper = await mountPage();
    await button(wrapper, "Set to 3").trigger("click");
    await flushPromises();

    expect(setPickCalls()).toEqual([{ ids: ["c"], pick: 3 }]);
    expect(wrapper.findAll("li")).toHaveLength(2);
  });

  it("asks before fixing all, then sends one request per suggested pick", async () => {
    const wrapper = await mountPage();
    await button(wrapper, "Fix all 3").trigger("click");
    await flushPromises();
    expect(setPickCalls()).toEqual([]);

    await button(wrapper, "Set 3 cards to their blank count?").trigger("click");
    await flushPromises();

    expect(setPickCalls()).toEqual([
      { ids: ["a", "b"], pick: 2 },
      { ids: ["c"], pick: 3 },
    ]);
    expect(wrapper.findAll("li")).toHaveLength(0);
  });
});

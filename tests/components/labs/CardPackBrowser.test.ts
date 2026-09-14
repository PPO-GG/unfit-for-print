// tests/components/labs/CardPackBrowser.test.ts
//
// The Labs card browser pages its lightbox across the whole filtered result
// set, so stepping from card 24 to card 25 has to pull page 2. That step must
// never make the lightbox vanish: it used to unmount outright while the page
// was in flight, because it sat inside the grid's loading branch.
import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as Vue from "vue";
import type { BrowsableCard, CardBrowseResponse } from "~/types/cardBrowser";

Object.assign(globalThis, Vue);
vi.unmock("vue");

const PER_PAGE = 24;

interface PendingRequest {
  query: Record<string, unknown>;
  resolve: (value: CardBrowseResponse) => void;
  reject: (error: unknown) => void;
}

let requests: PendingRequest[] = [];

const activityFetch = vi.fn(
  (_url: string, options: { query: Record<string, unknown> }) =>
    new Promise<CardBrowseResponse>((resolve, reject) => {
      requests.push({ query: options.query, resolve, reject });
    }),
);

vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: activityFetch }));
vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
vi.stubGlobal("useToast", () => ({ add: vi.fn() }));
vi.stubGlobal("useCardPacks", () => ({
  tiles: Vue.ref([]),
  seriesPrefix: Vue.ref(""),
  loading: Vue.ref(false),
  load: vi.fn(),
}));

import CardPackBrowser from "~/components/labs/CardPackBrowser.vue";

function card(index: number): BrowsableCard {
  return {
    id: `w${index}`,
    text: `Card ${index + 1}`,
    pack: "Base",
    packId: "p1",
    packSeries: null,
    imageKey: null,
    imageFormat: null,
    attachment: null,
  };
}

function pageOf(page: number, total: number): CardBrowseResponse {
  const start = (page - 1) * PER_PAGE;
  const end = Math.min(start + PER_PAGE, total);
  return {
    cards: Array.from({ length: end - start }, (_, i) => card(start + i)),
    total,
    page,
    perPage: PER_PAGE,
  };
}

function requestsFor(page: number) {
  return requests.filter((request) => request.query.page === page);
}

/** Answers every outstanding request for `page`. */
async function respond(page: number, total: number) {
  for (const request of requestsFor(page)) request.resolve(pageOf(page, total));
  await flushPromises();
}

const LightboxStub = Vue.defineComponent({
  name: "LabsCardLightbox",
  props: ["card", "type", "position", "total", "pending", "open"],
  emits: ["step", "update:open"],
  template: "<div class='lightbox-stub' />",
});

function mountBrowser() {
  return mount(CardPackBrowser, {
    global: {
      stubs: {
        LabsCardLightbox: LightboxStub,
        LabsCardPackGrid: true,
        ClientOnly: { template: "<slot />" },
        UInput: true,
        USelect: true,
        UPagination: true,
        Icon: true,
      },
    },
  });
}

/** Opens a pack of `total` cards and the lightbox on 0-based `index`. */
async function openAt(total: number, index: number) {
  const wrapper = mountBrowser();
  const vm = wrapper.vm as any;
  vm.openPack("p1");
  await flushPromises();
  await respond(1, total);
  vm.openLightbox(index);
  await flushPromises();
  return { wrapper, vm };
}

function lightbox(wrapper: ReturnType<typeof mountBrowser>) {
  return wrapper.findComponent(LightboxStub);
}

beforeEach(() => {
  requests = [];
  activityFetch.mockClear();
});

describe("CardPackBrowser — lightbox across a page boundary", () => {
  it("keeps the lightbox mounted, showing the last card, while the next page loads", async () => {
    const { wrapper, vm } = await openAt(30, 23);
    expect(lightbox(wrapper).props("card")?.id).toBe("w23");

    vm.stepLightbox(1);
    await flushPromises();

    expect(requestsFor(2)).toHaveLength(1);
    const box = lightbox(wrapper);
    expect(box.exists()).toBe(true);
    // Never page 1's card 1, which is what `cards[offset]` holds mid-flight.
    expect(box.props("card")?.id).toBe("w23");
    expect(box.props("pending")).toBe(true);
    expect(box.props("position")).toBe(25);

    await respond(2, 30);

    expect(lightbox(wrapper).props("card")?.id).toBe("w24");
    expect(lightbox(wrapper).props("pending")).toBe(false);
  });

  it("prefetches the adjacent page near a boundary so the step lands instantly", async () => {
    const { wrapper, vm } = await openAt(60, 21);

    // Card 22 of 24 is within reach of page 2.
    expect(requestsFor(2)).toHaveLength(1);
    await respond(2, 60);

    vm.stepLightbox(3);
    await flushPromises();

    expect(requestsFor(2)).toHaveLength(1);
    expect(lightbox(wrapper).props("card")?.id).toBe("w24");
    expect(lightbox(wrapper).props("pending")).toBe(false);
  });

  it("does not prefetch from the middle of a page", async () => {
    await openAt(60, 10);
    expect(requests.map((request) => request.query.page)).toEqual([1]);
  });

  it("reuses an in-flight prefetch instead of requesting the page again", async () => {
    const { wrapper, vm } = await openAt(60, 23);
    expect(requestsFor(2)).toHaveLength(1);

    vm.stepLightbox(1);
    await flushPromises();
    expect(requestsFor(2)).toHaveLength(1);
    expect(lightbox(wrapper).props("pending")).toBe(true);

    await respond(2, 60);
    expect(lightbox(wrapper).props("card")?.id).toBe("w24");
  });

  it("settles a burst across two boundaries into one request for the landing page", async () => {
    const { wrapper, vm } = await openAt(100, 23);
    for (let i = 0; i < 30; i++) vm.stepLightbox(1);
    await flushPromises();

    expect(requestsFor(3)).toHaveLength(1);
    expect(lightbox(wrapper).props("position")).toBe(54);

    await respond(3, 100);
    expect(lightbox(wrapper).props("card")?.id).toBe("w53");
  });

  it("discards a stale reply for a page the lightbox already left", async () => {
    const { wrapper, vm } = await openAt(100, 20);
    vm.stepLightbox(30); // index 50 → page 3, left in flight
    await flushPromises();
    expect(requestsFor(3)).toHaveLength(1);
    vm.stepLightbox(-30); // back to index 20 on page 1, already loaded once
    await flushPromises();

    await respond(3, 100);
    expect(lightbox(wrapper).props("card")?.id).toBe("w20");
    expect(lightbox(wrapper).props("pending")).toBe(false);
  });

  it("resets the lightbox and forgets its last card when a filter changes", async () => {
    const { wrapper, vm } = await openAt(30, 23);
    vm.setType("black");
    await flushPromises();

    expect(vm.lightboxOpen).toBe(false);
    expect(vm.lightboxGlobalIndex).toBe(0);
    expect(lightbox(wrapper).props("card")).toBeNull();
    // Page 1 of the white cards must not answer for the black ones.
    expect(requests.at(-1)?.query).toMatchObject({ type: "black", page: 1 });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref, onMounted } from "vue";

// ReportViewer leans on Nuxt's auto-imports, which plain vitest doesn't provide.
vi.stubGlobal("ref", ref);
vi.stubGlobal("onMounted", onMounted);
const fetchMock = vi.fn();
vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: fetchMock }));

const confirmMock = vi.fn();
vi.mock("~/composables/useConfirm", () => ({
  useConfirm: () => ({ confirm: confirmMock }),
}));
vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));

import ReportViewer from "~/components/admin/ReportViewer.vue";

const stubs = {
  UBadge: { template: "<span><slot /></span>" },
  UButton: { template: `<button v-bind="$attrs"><slot /></button>` },
  USkeleton: { template: "<div />" },
  UIcon: { template: "<i />" },
  UTextarea: { template: "<textarea />" },
  UFieldGroup: { template: "<div><slot /></div>" },
};

const report = (id: string, cardId: string) => ({
  id,
  cardId,
  cardType: "white",
  reason: "Incorrect spelling or grammar",
  reportedBy: "u1",
  createdAt: new Date().toISOString(),
  cardText: `Card ${cardId}`,
  cardPack: "Base",
  cardActive: true,
  cardPick: null,
});

const callsTo = (url: string) =>
  fetchMock.mock.calls.filter(([u]) => u === url).map(([, opts]) => opts.body);

const button = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll("button").find((b) => b.text() === text)!;

async function mountViewer() {
  const wrapper = mount(ReportViewer, { global: { stubs } });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  confirmMock.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    url === "/api/admin/reports"
      ? { reports: [report("r1", "c1"), report("r2", "c2")] }
      : { success: true },
  );
});

describe("ReportViewer destructive actions", () => {
  it("keeps the card when Delete Card is declined", async () => {
    confirmMock.mockResolvedValue(false);
    const wrapper = await mountViewer();
    await wrapper.find(".report-row").trigger("click");
    await button(wrapper, "Delete Card").trigger("click");
    await flushPromises();

    expect(confirmMock).toHaveBeenCalledOnce();
    expect(callsTo("/api/admin/reports/card-action")).toEqual([]);
  });

  it("deletes the card once Delete Card is confirmed", async () => {
    confirmMock.mockResolvedValue(true);
    const wrapper = await mountViewer();
    await wrapper.find(".report-row").trigger("click");
    await button(wrapper, "Delete Card").trigger("click");
    await flushPromises();

    expect(callsTo("/api/admin/reports/card-action")).toEqual([
      { action: "delete", cardId: "c1", cardType: "white" },
    ]);
  });

  it("dismisses nothing when Dismiss All is declined", async () => {
    confirmMock.mockResolvedValue(false);
    const wrapper = await mountViewer();
    await button(wrapper, "Dismiss All").trigger("click");
    await flushPromises();

    expect(confirmMock).toHaveBeenCalledOnce();
    expect(callsTo("/api/admin/reports/dismiss")).toEqual([]);
  });

  it("dismisses every report once Dismiss All is confirmed", async () => {
    confirmMock.mockResolvedValue(true);
    const wrapper = await mountViewer();
    await button(wrapper, "Dismiss All").trigger("click");
    await flushPromises();

    expect(callsTo("/api/admin/reports/dismiss")).toEqual([
      { reportId: "r1" },
      { reportId: "r2" },
    ]);
  });
});

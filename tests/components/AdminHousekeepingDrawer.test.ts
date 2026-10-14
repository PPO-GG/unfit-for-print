import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AdminHousekeepingDrawer from "~/components/admin/AdminHousekeepingDrawer.vue";

const global = {
  stubs: {
    USlideover: { props: ["open", "title"], template: "<div v-if='open'><slot name='body' /><slot name='footer' /></div>" },
    UButton: { template: "<button v-bind='$attrs'><slot /></button>" },
  },
};

const housekeeping = {
  dbOnlyStale: [{ code: "RT8Q", ageSec: 3 * 3600 }],
  dbOnlyRecent: [{ code: "CC7A", ageSec: 720 }],
  finished: [{ code: "FIN1", ageSec: 7200 }],
  emptyRooms: [{ code: "ZX2M", expiresInSec: 60 }],
  noRecord: [{ code: "GHST", ageSec: 30 }],
  leftoverCount: 4,
};
const server = { version: "2.0.0-durable", activeClients: 31, activeDocuments: 8, idleDocTtlSec: 600 };

const mountIt = (cleanupDisabled = false) =>
  mount(AdminHousekeepingDrawer, {
    props: { open: true, housekeeping, server, liveGames: 8, livePlayers: 31, cleanupDisabled },
    global,
  });

describe("AdminHousekeepingDrawer", () => {
  it("groups leftovers with ages and explanations", () => {
    const w = mountIt();
    expect(w.get("[data-testid='hk-db-only']").text()).toContain("RT8Q (3h 0m)");
    expect(w.get("[data-testid='hk-db-only']").text()).toContain("CC7A (12m)");
    expect(w.get("[data-testid='hk-finished']").text()).toContain("FIN1");
    expect(w.get("[data-testid='hk-empty']").text()).toContain("ZX2M · expires in about 1 min");
    expect(w.get("[data-testid='hk-no-record']").text()).toContain("GHST");
    expect(w.text()).toContain("2.0.0-durable");
  });

  it("turns clean-up off while the lobby status is unavailable", () => {
    const off = mountIt(true);
    expect(off.get("[data-testid='hk-prune-stale']").attributes("disabled")).toBeDefined();
    expect(off.get("[data-testid='hk-prune-all']").attributes("disabled")).toBeDefined();
    expect(off.text()).toContain("Clean-up is off until the lobby status loads again.");

    const on = mountIt();
    expect(on.get("[data-testid='hk-prune-stale']").attributes("disabled")).toBeUndefined();
    expect(on.get("[data-testid='hk-prune-all']").attributes("disabled")).toBeUndefined();
    expect(on.text()).not.toContain("Clean-up is off");
  });

  it("emits the clean-up actions", async () => {
    const w = mountIt();
    await w.get("[data-testid='hk-prune-stale']").trigger("click");
    await w.get("[data-testid='hk-prune-all']").trigger("click");
    await w.get("[data-testid='hk-end-all']").trigger("click");
    await w.get("[data-testid='hk-end-GHST']").trigger("click");
    expect(w.emitted("pruneStale")).toHaveLength(1);
    expect(w.emitted("pruneAll")).toHaveLength(1);
    expect(w.emitted("endAll")).toHaveLength(1);
    expect(w.emitted("endGame")?.[0]).toEqual(["GHST"]);
    expect(w.get("[data-testid='hk-end-all']").text()).toContain("End every live game (8) & disconnect 31 players…");
  });
});

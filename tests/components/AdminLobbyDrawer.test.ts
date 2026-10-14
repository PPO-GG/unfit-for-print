import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AdminLobbyDrawer from "~/components/admin/AdminLobbyDrawer.vue";
import AdminSourceBadge from "~/components/admin/AdminSourceBadge.vue";
import { liveLobby } from "../helpers/unifiedLobby";

const NOW = Date.parse("2026-10-13T12:12:00.000Z");
const global = {
  stubs: {
    USlideover: { props: ["open", "title"], template: "<div v-if='open'><slot name='body' /></div>" },
    UButton: { template: "<button v-bind='$attrs'><slot /></button>" },
    NuxtLink: { props: ["to"], template: "<a :href='to'><slot /></a>" },
    UIcon: true,
  },
  components: { AdminSourceBadge },
};

const mountDrawer = (props: Record<string, unknown>) =>
  mount(AdminLobbyDrawer, {
    props: { open: true, code: "AB12", lobby: liveLobby("AB12"), issues: [], health: null, now: NOW, ...props },
    global,
  });

describe("AdminLobbyDrawer", () => {
  it("lists players with roles, presence, plays and scores", () => {
    const w = mountDrawer({ lobby: liveLobby("AB12", { onlinePlayerIds: ["u2", "u3"] }) });
    const rows = w.findAll("[data-testid='drawer-player']");
    expect(rows).toHaveLength(3);
    expect(rows[0]!.text()).toContain("Mo");
    expect(rows[0]!.text()).toContain("host");
    expect(rows[0]!.text()).toContain("judge");
    expect(rows[0]!.text()).toContain("● offline");
    expect(rows[1]!.text()).toContain("● online");
    expect(rows[1]!.text()).toContain("played ✓");
    expect(rows[1]!.text()).toContain("3");
  });

  it("omits presence when it is unknown", () => {
    const w = mountDrawer({ lobby: liveLobby("AB12", { anonymousClients: 1 }) });
    expect(w.text()).not.toContain("offline");
    expect(w.text()).not.toContain("online");
  });

  it("shows the alert and linked issues", () => {
    const w = mountDrawer({
      health: { level: "red", reason: "Judge Mo is offline" },
      issues: [{ groupId: "g1", title: "judge-missing", kind: "anomaly", eventCount: 2 }],
    });
    expect(w.get("[data-testid='drawer-alert']").text()).toContain("Judge Mo is offline");
    expect(w.get("a[href='/admin/issues/g1']").text()).toContain("judge-missing");
  });

  it("offers only the actions that apply", () => {
    const live = mountDrawer({});
    expect(live.find("[data-testid='action-end-game']").exists()).toBe(true);
    expect(live.find("[data-testid='action-remove']").exists()).toBe(true);
    expect(live.find("[data-testid='action-delete-record']").exists()).toBe(false);

    const recordOnly = mountDrawer({ lobby: { ...liveLobby("AB12"), hasLiveDoc: false, teleportal: null } });
    expect(recordOnly.find("[data-testid='action-end-game']").exists()).toBe(false);
    expect(recordOnly.find("[data-testid='action-delete-record']").exists()).toBe(true);
  });

  it("says when the lobby is gone", () => {
    const w = mountDrawer({ lobby: null, code: "GONE" });
    expect(w.text()).toContain("GONE is no longer live");
  });

  it("emits the action with the lobby", async () => {
    const lobby = liveLobby("AB12");
    const w = mountDrawer({ lobby });
    await w.get("[data-testid='action-end-game']").trigger("click");
    expect(w.emitted("endGame")?.[0]).toEqual([lobby]);
  });
});

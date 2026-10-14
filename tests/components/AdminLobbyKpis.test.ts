import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AdminLobbyKpis from "~/components/admin/AdminLobbyKpis.vue";

const kpis = {
  gamesRunning: 6, waiting: 2, players: 31, humans: 27, bots: 4,
  bySource: { discord: 17, web: 10, unknown: 0 },
};
const activity = {
  windowHours: 24, lobbiesCreated: 42, uniquePlayers: 118,
  lobbiesBySource: { web: 15, discord: 27, unknown: 0 },
  playersBySource: { web: 40, discord: 70, unknown: 8 },
};

describe("AdminLobbyKpis", () => {
  it("shows live counts and the Discord/web split", () => {
    const w = mount(AdminLobbyKpis, { props: { kpis, activity } });
    expect(w.get("[data-testid='kpi-games']").text()).toContain("6");
    expect(w.get("[data-testid='kpi-games']").text()).toContain("+2 waiting in lobby");
    expect(w.get("[data-testid='kpi-source']").text()).toContain("Discord 17");
    expect(w.get("[data-testid='kpi-source']").text()).toContain("Web 10");
    expect(w.get("[data-testid='kpi-source']").text()).not.toContain("Unknown");
  });

  it("gives the 24h Discord share over known rows and says some are unknown", () => {
    const w = mount(AdminLobbyKpis, { props: { kpis, activity } });
    const tile = w.get("[data-testid='kpi-24h']").text();
    expect(tile).toContain("42");
    expect(tile).toContain("Discord 64%");
    expect(tile).toContain("8 players from before tracking");
  });

  it("renders a dash when the 24h stats failed to load", () => {
    const w = mount(AdminLobbyKpis, { props: { kpis, activity: null } });
    expect(w.get("[data-testid='kpi-24h']").text()).toContain("—");
  });
});

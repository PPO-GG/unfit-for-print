import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AdminLobbyCard from "~/components/admin/AdminLobbyCard.vue";
import AdminSourceBadge from "~/components/admin/AdminSourceBadge.vue";
import { liveLobby } from "../helpers/unifiedLobby";

const NOW = Date.parse("2026-10-13T11:24:00.000Z");
const global = { stubs: { UIcon: true }, components: { AdminSourceBadge } };

describe("AdminLobbyCard", () => {
  it("says what the game is doing in plain words", () => {
    const w = mount(AdminLobbyCard, { props: { lobby: liveLobby("AB12"), now: NOW }, global });
    expect(w.text()).toContain("Friday");
    expect(w.text()).toContain("AB12 · host Mo · 24m");
    expect(w.get("[data-testid='lobby-status']").text()).toBe("Submitting · round 2 · first to 7");
    expect(w.text()).toContain("1/2 played");
    expect(w.get("[data-testid='lobby-progress']").attributes("style")).toContain("width: 43%");
  });

  it("renders a lobby from an old worker without scores or presence", () => {
    const lobby = liveLobby("OLD1", {
      lobbyName: null, hostUserId: null, judgeId: null, scores: {}, maxPoints: null,
      submittedIds: [], onlinePlayerIds: null, anonymousClients: null, phase: "judging", round: null,
    });
    const w = mount(AdminLobbyCard, { props: { lobby, now: NOW }, global });
    expect(w.get("[data-testid='lobby-status']").text()).toBe("Judging");
    expect(w.find("[data-testid='lobby-progress']").exists()).toBe(false);
  });

  it("emits open with the code", async () => {
    const w = mount(AdminLobbyCard, { props: { lobby: liveLobby("AB12"), now: NOW }, global });
    await w.get("[data-testid='lobby-card']").trigger("click");
    expect(w.emitted("open")?.[0]).toEqual(["AB12"]);
  });
});

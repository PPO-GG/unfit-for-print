import { describe, it, expect } from "vitest";
import { decideLobbyEntry, type LobbyEntryFacts } from "~/utils/lobbyEntry";

const facts = (over: Partial<LobbyEntryFacts> = {}): LobbyEntryFacts => ({
  inDoc: false,
  seatedHere: false,
  seatedElsewhere: false,
  kicked: false,
  docInitialized: true,
  isHost: false,
  ...over,
});

describe("decideLobbyEntry", () => {
  it("lets in anyone the live doc already has", () => {
    expect(decideLobbyEntry(facts({ inDoc: true }))).toBe("in");
    // Being in the doc settles it, whatever the server lookup said.
    expect(decideLobbyEntry(facts({ inDoc: true, seatedElsewhere: true }))).toBe("in");
  });

  // The server's player rows are who belongs: create and join write them,
  // leave and kick delete them. A refresh or a dropped doc loses the doc entry,
  // not the seat.
  it("puts a seated player back into the doc", () => {
    expect(decideLobbyEntry(facts({ seatedHere: true }))).toBe("rejoin");
  });

  // The sync server drops a doc once everyone disconnects. Before, a host who
  // reloaded alone got an empty "Untitled lobby" (with ?creator=true) or the
  // join card for their own lobby (without it).
  it("has the host rebuild a doc the sync server dropped", () => {
    expect(decideLobbyEntry(facts({ seatedHere: true, isHost: true, docInitialized: false }))).toBe(
      "rebuild",
    );
  });

  it("re-seats a guest in a dropped doc without rebuilding it", () => {
    expect(decideLobbyEntry(facts({ seatedHere: true, docInitialized: false }))).toBe("rejoin");
  });

  it("sends home a seated player the host kicked", () => {
    expect(decideLobbyEntry(facts({ seatedHere: true, kicked: true }))).toBe("kicked");
  });

  it("redirects someone seated in a different lobby", () => {
    expect(decideLobbyEntry(facts({ seatedElsewhere: true }))).toBe("redirect");
  });

  it("shows everyone else the join card", () => {
    expect(decideLobbyEntry(facts())).toBe("join");
    // A kicked marker alone doesn't bounce someone off the join card.
    expect(decideLobbyEntry(facts({ kicked: true }))).toBe("join");
  });
});

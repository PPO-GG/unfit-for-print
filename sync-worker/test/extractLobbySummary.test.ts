import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { extractLobbySummary } from "../src/extractLobbySummary";

describe("extractLobbySummary", () => {
  it("reads an empty doc as an empty summary", () => {
    expect(extractLobbySummary(new Y.Doc())).toEqual({
      players: [],
      meta: {},
      status: undefined,
      lobbyName: undefined,
      isPrivate: undefined,
      phase: undefined,
      round: undefined,
    });
  });

  it("parses JSON-string players and falls back for missing names", () => {
    const doc = new Y.Doc();
    const players = doc.getMap("players");
    players.set("u1", JSON.stringify({ name: "Dylan", avatar: "a.png" }));
    players.set("u2", JSON.stringify({ displayName: "Jev", isBot: true }));
    players.set("u3", JSON.stringify({}));
    players.set("u4", "{not json");
    expect(extractLobbySummary(doc).players).toEqual([
      { id: "u1", name: "Dylan", avatar: "a.png", isBot: false },
      { id: "u2", name: "Jev", avatar: undefined, isBot: true },
      { id: "u3", name: "Unknown", avatar: undefined, isBot: false },
      { id: "u4", name: "Unknown" },
    ]);
  });

  it("reads status, name, privacy, phase and round with type guards", () => {
    const doc = new Y.Doc();
    doc.getMap("meta").set("status", "playing");
    doc.getMap("meta").set("hostName", "Dylan");
    doc.getMap("settings").set("lobbyName", "Party Night");
    doc.getMap("settings").set("isPrivate", true);
    doc.getMap("gameState").set("phase", "judging");
    doc.getMap("gameState").set("round", 3);
    expect(extractLobbySummary(doc)).toMatchObject({
      meta: { status: "playing", hostName: "Dylan" },
      status: "playing",
      lobbyName: "Party Night",
      isPrivate: true,
      phase: "judging",
      round: 3,
    });
  });

  it("drops values of the wrong type", () => {
    const doc = new Y.Doc();
    doc.getMap("meta").set("status", 7);
    doc.getMap("settings").set("isPrivate", "yes");
    doc.getMap("gameState").set("round", "3");
    const summary = extractLobbySummary(doc);
    expect(summary.status).toBeUndefined();
    expect(summary.isPrivate).toBeUndefined();
    expect(summary.round).toBeUndefined();
  });
});

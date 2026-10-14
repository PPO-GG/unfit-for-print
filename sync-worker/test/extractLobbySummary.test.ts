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
      submittedIds: [],
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

  it("marks bots by playerType or provider, and carries playerType", () => {
    const doc = new Y.Doc();
    const players = doc.getMap("players");
    players.set("b1", JSON.stringify({ name: "Jev", playerType: "bot", provider: "bot" }));
    players.set("b2", JSON.stringify({ name: "Old", provider: "bot" }));
    players.set("s1", JSON.stringify({ name: "Sam", playerType: "spectator" }));
    expect(extractLobbySummary(doc).players).toEqual([
      { id: "b1", name: "Jev", avatar: undefined, isBot: true, playerType: "bot" },
      { id: "b2", name: "Old", avatar: undefined, isBot: true, playerType: undefined },
      { id: "s1", name: "Sam", avatar: undefined, isBot: false, playerType: "spectator" },
    ]);
  });

  it("reads host, judge, scores and win target", () => {
    const doc = new Y.Doc();
    doc.getMap("meta").set("hostUserId", "u1");
    doc.getMap("gameState").set("judgeId", "u2");
    doc.getMap("gameState").set("scores", JSON.stringify({ u1: 3, u2: 5, u3: "x" }));
    doc.getMap("settings").set("maxPoints", 7);
    expect(extractLobbySummary(doc)).toMatchObject({
      hostUserId: "u1",
      judgeId: "u2",
      scores: { u1: 3, u2: 5 },
      maxPoints: 7,
    });
  });

  it("treats unparseable scores and a null judge as absent", () => {
    const doc = new Y.Doc();
    doc.getMap("gameState").set("scores", "{nope");
    doc.getMap("gameState").set("judgeId", null);
    const summary = extractLobbySummary(doc);
    expect(summary.scores).toBeUndefined();
    expect(summary.judgeId).toBeUndefined();
  });

  it("unions per-player submissions with the legacy blob, skipping empty plays", () => {
    const doc = new Y.Doc();
    const subs = doc.getMap("submissions");
    subs.set("u1", JSON.stringify(["w1"]));
    subs.set("u2", JSON.stringify([]));
    subs.set("u3", "{bad");
    doc.getMap("gameState").set("submissions", JSON.stringify({ u4: ["w9"], u1: ["w1"] }));
    expect(extractLobbySummary(doc).submittedIds.sort()).toEqual(["u1", "u4"]);
  });

  it("reads a cleared legacy blob as no submissions", () => {
    const doc = new Y.Doc();
    doc.getMap("gameState").set("submissions", "{}");
    expect(extractLobbySummary(doc).submittedIds).toEqual([]);
  });
});

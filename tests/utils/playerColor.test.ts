// The lobby gives every player one accent colour, used by their card band,
// their ready pip and the compact list's avatar. It must be a pure function
// of the id so all three agree, and it must keep the exact hash the old
// LobbySeat/LobbyPlayerList copies used so nobody's colour changes.
import { describe, expect, it } from "vitest";
import {
  playerAccent,
  playerAvatarStyle,
  playerColor,
  playerInitials,
} from "~/utils/playerColor";

describe("playerColor", () => {
  it("keeps the legacy hash → palette mapping", () => {
    expect(playerColor("u1")).toBe("#f59e0b");
    expect(playerColor("u2")).toBe("#a78bfa");
    expect(playerColor("h1")).toBe("#f43f5e");
    expect(playerColor("abc")).toBe("#22d3ee");
    expect(playerColor("")).toBe("#5865f2");
  });
});

describe("playerAccent", () => {
  it("uses userId, falling back to $id", () => {
    expect(playerAccent({ userId: "u2", $id: "x" })).toBe("#a78bfa");
    expect(playerAccent({ $id: "u2" })).toBe("#a78bfa");
  });

  it("gives every bot the bot yellow", () => {
    expect(playerAccent({ userId: "u2", playerType: "bot" })).toBe("#f59e0b");
  });
});

describe("playerInitials", () => {
  it("takes first + last initials for multi-word names", () => {
    expect(playerInitials({ name: "dylan james roberson" })).toBe("DR");
  });
  it("takes the first two letters of a single word", () => {
    expect(playerInitials({ name: "sam" })).toBe("SA");
  });
  it("falls back to ? for a blank name and 🤖 for bots", () => {
    expect(playerInitials({ name: "  " })).toBe("?");
    expect(playerInitials({ name: "Jev", playerType: "bot" })).toBe("🤖");
  });
});

describe("playerAvatarStyle", () => {
  it("tints a person's avatar from their colour", () => {
    expect(playerAvatarStyle({ userId: "u2" })).toEqual({
      background: "linear-gradient(135deg, #a78bfaaa 0%, #a78bfa55 100%)",
      color: "#0d0f1a",
    });
  });
  it("uses the bot gradient for bots", () => {
    expect(playerAvatarStyle({ userId: "u2", playerType: "bot" }).background)
      .toBe("linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)");
  });
});

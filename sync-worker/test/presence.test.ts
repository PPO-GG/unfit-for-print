import { describe, expect, it } from "vitest";
import { playerIdFromUrl, summarizePresence } from "../src/presence";

describe("playerIdFromUrl", () => {
  it("reads a uuid-like pid", () => {
    expect(playerIdFromUrl("https://sync.test/parties/lobby/AB12?pid=3f2a-91_x")).toBe("3f2a-91_x");
  });

  it("ignores a missing, empty, oversized or odd pid", () => {
    expect(playerIdFromUrl("https://sync.test/parties/lobby/AB12")).toBeNull();
    expect(playerIdFromUrl("https://sync.test/parties/lobby/AB12?pid=")).toBeNull();
    expect(playerIdFromUrl(`https://sync.test/x?pid=${"a".repeat(65)}`)).toBeNull();
    expect(playerIdFromUrl("https://sync.test/x?pid=<script>")).toBeNull();
    expect(playerIdFromUrl("not a url")).toBeNull();
  });
});

describe("summarizePresence", () => {
  it("lists each open player once and counts open sockets without a pid", () => {
    expect(
      summarizePresence([
        { open: true, playerId: "u1" },
        { open: true, playerId: "u1" },
        { open: true, playerId: null },
        { open: false, playerId: "u2" },
      ]),
    ).toEqual({ onlinePlayerIds: ["u1"], anonymousClients: 1 });
  });
});

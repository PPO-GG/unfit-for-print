import { describe, expect, it } from "vitest";
import { isActivePhase, phaseInfo } from "~/utils/lobbyPhase";

describe("phaseInfo", () => {
  it.each([
    ["waiting", "In lobby", "neutral"],
    ["submitting", "Submitting", "primary"],
    ["submitting-complete", "Submitting", "primary"],
    ["judging", "Judging", "secondary"],
    ["roundEnd", "Round over", "success"],
    ["complete", "Game over", "success"],
  ])("labels %s as %s", (phase, label, color) => {
    expect(phaseInfo(phase)).toMatchObject({ label, color });
  });

  it("treats a missing phase as the lobby and shows unknown ones raw", () => {
    expect(phaseInfo(null).label).toBe("In lobby");
    expect(phaseInfo("mystery")).toMatchObject({ label: "mystery", color: "neutral" });
  });
});

describe("isActivePhase", () => {
  it("is true only mid-round", () => {
    expect(["submitting", "submitting-complete", "judging", "roundEnd"].every(isActivePhase)).toBe(true);
    expect([null, "waiting", "complete"].some(isActivePhase)).toBe(false);
  });
});

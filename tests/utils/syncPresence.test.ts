import { describe, expect, it } from "vitest";
import { presenceParams } from "~/utils/syncPresence";

describe("presenceParams", () => {
  it("sends the player id as pid", () => {
    expect(presenceParams("3f2a-91")).toEqual({ pid: "3f2a-91" });
  });

  it("sends nothing when the player is unknown", () => {
    expect(presenceParams(undefined)).toEqual({});
    expect(presenceParams(null)).toEqual({});
    expect(presenceParams("")).toEqual({});
  });
});

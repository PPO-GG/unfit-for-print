// The rule this pins, in one sentence: auxiliary rows travel only when the
// move empties the source pack, and the target always wins a collision.
// Whether the target "existed" (cards or rows, checked before the move) is
// the route's job to work out; this function only applies the rule.
import { describe, it, expect } from "vitest";
import { planPackMove } from "~/server/utils/planPackMove";

describe("planPackMove", () => {
  it("moves the aux rows on a plain rename (source emptied, nothing at the target)", () => {
    expect(planPackMove({ sourceRetainsCards: false, targetExisted: false }))
      .toEqual({ aux: "move" });
  });

  it("drops the source's aux rows on a merge, so the target's metadata wins", () => {
    expect(planPackMove({ sourceRetainsCards: false, targetExisted: true }))
      .toEqual({ aux: "drop" });
  });

  it("leaves the source's aux rows alone on a partial split", () => {
    expect(planPackMove({ sourceRetainsCards: true, targetExisted: false }))
      .toEqual({ aux: "leave" });
  });

  it("leaves the source alone on a partial split even when the target existed", () => {
    expect(planPackMove({ sourceRetainsCards: true, targetExisted: true }))
      .toEqual({ aux: "leave" });
  });
});

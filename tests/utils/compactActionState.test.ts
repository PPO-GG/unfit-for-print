import { describe, it, expect } from "vitest";
import {
  compactActionState,
  type CompactActionInput,
} from "~/utils/compactActionState";

const base: CompactActionInput = {
  phase: "submitting",
  isJudge: false,
  isSpectator: false,
  isSkipped: false,
  hasSubmitted: false,
  selectedCount: 0,
  pick: 1,
  allRevealed: false,
  pendingWinner: null,
  canAdvance: false,
  judgeName: "Mynd",
  waitingOn: ["Grover", "Leopard"],
};
const s = (o: Partial<CompactActionInput>) => compactActionState({ ...base, ...o });

describe("compactActionState", () => {
  it.each([
    ["needs more picks", {}, "compact.select_more", null, { count: 1 }],
    ["ready to submit", { selectedCount: 1 }, "compact.submit", "submit", undefined],
    ["pick 2 submit", { pick: 2, selectedCount: 2 }, "compact.submit_plural", "submit", undefined],
    ["submitted, many waiting", { hasSubmitted: true }, "compact.waiting_on_count", null, { count: 2 }],
    ["submitted, one waiting", { hasSubmitted: true, waitingOn: ["Grover"] }, "compact.waiting_on", null, { name: "Grover" }],
    ["judge while submitting", { isJudge: true }, "compact.waiting_on_count", null, { count: 2 }],
    ["everyone in", { isJudge: true, waitingOn: [] }, "compact.all_in", null, undefined],
    ["spectator", { isSpectator: true }, "compact.spectating", null, undefined],
    ["skipped player with a full pick", { isSkipped: true, selectedCount: 1 }, "compact.skipped", null, undefined],
    ["submitting-complete", { phase: "submitting-complete" }, "compact.all_in", null, undefined],
    ["judge, unrevealed", { phase: "judging", isJudge: true }, "compact.reveal_all", null, undefined],
    ["judge, nothing picked", { phase: "judging", isJudge: true, allRevealed: true }, "compact.tap_to_pick", null, undefined],
    ["judge, picked", { phase: "judging", isJudge: true, allRevealed: true, pendingWinner: "p1" }, "compact.crown", "crown", undefined],
    ["watcher during judging", { phase: "judging" }, "compact.waiting_for_judge", null, { name: "Mynd" }],
    ["host at round end", { phase: "roundEnd", canAdvance: true }, "compact.next_round", "next-round", undefined],
    ["non-host at round end", { phase: "roundEnd" }, "compact.next_round_soon", null, undefined],
    ["game over", { phase: "complete" }, "game.game_over", null, undefined],
  ])("%s", (_name, over, labelKey, action, params) => {
    const st = s(over as Partial<CompactActionInput>);
    expect(st.labelKey).toBe(labelKey);
    expect(st.action).toBe(action);
    expect(st.params).toEqual(params);
  });

  it("never gives an actionable tone to a state with no action", () => {
    for (const phase of ["submitting", "submitting-complete", "judging", "roundEnd", "complete"]) {
      for (const isJudge of [true, false]) {
        const st = s({ phase, isJudge });
        if (st.action === null) expect(st.tone).toBe("muted");
      }
    }
  });
});

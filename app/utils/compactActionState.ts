/**
 * What the compact view's single bottom button says and does, for every
 * phase and role. Pure so each state is a table row in a test — the old mobile
 * bar had enabled buttons whose handlers silently did nothing; here a state
 * with no action is always muted (and the component disables it).
 */
export type CompactAction = "submit" | "crown" | "next-round";
export type CompactTone = "primary" | "judge" | "muted";

export interface CompactActionInput {
  phase: string;
  isJudge: boolean;
  isSpectator: boolean;
  /** The engine skipped this player for the round; they cannot submit. */
  isSkipped: boolean;
  hasSubmitted: boolean;
  selectedCount: number;
  pick: number;
  allRevealed: boolean;
  pendingWinner: string | null;
  canAdvance: boolean;
  judgeName: string;
  /** Display names of non-judge players who have not submitted yet. */
  waitingOn: string[];
}

export interface CompactActionState {
  labelKey: string;
  params?: Record<string, string | number>;
  action: CompactAction | null;
  tone: CompactTone;
}

function muted(
  labelKey: string,
  params?: Record<string, string | number>,
): CompactActionState {
  return { labelKey, params, action: null, tone: "muted" };
}

function waiting(waitingOn: string[]): CompactActionState {
  if (waitingOn.length === 0) return muted("compact.all_in");
  if (waitingOn.length === 1) {
    return muted("compact.waiting_on", { name: waitingOn[0]! });
  }
  return muted("compact.waiting_on_count", { count: waitingOn.length });
}

export function compactActionState(i: CompactActionInput): CompactActionState {
  switch (i.phase) {
    case "submitting":
      if (i.isSpectator) return muted("compact.spectating");
      if (i.isSkipped) return muted("compact.skipped");
      if (i.isJudge || i.hasSubmitted) return waiting(i.waitingOn);
      if (i.selectedCount < i.pick) {
        return muted("compact.select_more", { count: i.pick - i.selectedCount });
      }
      return {
        labelKey: i.pick > 1 ? "compact.submit_plural" : "compact.submit",
        action: "submit",
        tone: "primary",
      };
    case "submitting-complete":
      return muted("compact.all_in");
    case "judging":
      if (!i.isJudge) {
        return muted("compact.waiting_for_judge", { name: i.judgeName });
      }
      if (!i.allRevealed) return muted("compact.reveal_all");
      if (!i.pendingWinner) return muted("compact.tap_to_pick");
      return { labelKey: "compact.crown", action: "crown", tone: "judge" };
    case "roundEnd":
      return i.canAdvance
        ? { labelKey: "compact.next_round", action: "next-round", tone: "primary" }
        : muted("compact.next_round_soon");
    default:
      return muted("game.game_over");
  }
}

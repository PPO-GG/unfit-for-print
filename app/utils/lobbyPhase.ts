// Labels and colours for game phases on the admin lobby monitor. The keys
// are GameState["phase"] (app/types/game.d.ts).

export type PhaseColor = "neutral" | "primary" | "secondary" | "success";

export interface PhaseInfo {
  label: string;
  /** Nuxt UI colour alias (primary = cyan, secondary = fuchsia, success = lime). */
  color: PhaseColor;
  textClass: string;
}

const PHASES: Record<string, PhaseInfo> = {
  waiting: { label: "In lobby", color: "neutral", textClass: "text-slate-400" },
  submitting: { label: "Submitting", color: "primary", textClass: "text-cyan-300" },
  "submitting-complete": { label: "Submitting", color: "primary", textClass: "text-cyan-300" },
  judging: { label: "Judging", color: "secondary", textClass: "text-fuchsia-300" },
  roundEnd: { label: "Round over", color: "success", textClass: "text-lime-300" },
  complete: { label: "Game over", color: "success", textClass: "text-lime-300" },
};

const ACTIVE = new Set(["submitting", "submitting-complete", "judging", "roundEnd"]);

export function phaseInfo(phase: string | null | undefined): PhaseInfo {
  if (!phase) return PHASES.waiting!;
  return PHASES[phase] ?? { label: phase, color: "neutral", textClass: "text-slate-400" };
}

/** Mid-round: someone is expected to act. */
export function isActivePhase(phase: string | null | undefined): boolean {
  return !!phase && ACTIVE.has(phase);
}

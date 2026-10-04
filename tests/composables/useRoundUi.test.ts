import { describe, it, expect } from "vitest";
import { nextTick, ref } from "vue";
import { useRoundUi } from "~/composables/useRoundUi";

function setup(overrides: Partial<Record<string, unknown>> = {}) {
  const src = {
    phase: ref("submitting"),
    promptSerial: ref<number | undefined>(1),
    pick: ref(2),
    isHost: ref(false),
    submissions: ref<Record<string, string[]>>({}),
    revealedCards: ref<Record<string, boolean>>({}),
    ...overrides,
  } as any;
  return { src, ui: useRoundUi(src) };
}

describe("useRoundUi — selection", () => {
  it("keeps pick order, caps at pick, and toggles off", () => {
    const { ui } = setup();
    ui.toggleCard("a");
    ui.toggleCard("b");
    ui.toggleCard("c"); // over the cap: ignored
    expect(ui.selected.value).toEqual(["a", "b"]);
    expect(ui.canSubmit.value).toBe(true);
    ui.toggleCard("a");
    expect(ui.selected.value).toEqual(["b"]);
    expect(ui.remainingPicks.value).toBe(1);
  });

  it("resets on a phase change and on a new prompt (skip), not on first serial", async () => {
    const { src, ui } = setup();
    ui.toggleCard("a");
    src.promptSerial.value = 2; // skip swapped the prompt
    await nextTick();
    expect(ui.selected.value).toEqual([]);
    ui.toggleCard("a");
    src.phase.value = "judging";
    await nextTick();
    expect(ui.selected.value).toEqual([]);
  });
});

describe("useRoundUi — judging", () => {
  it("only lets the judge pick once every submission is revealed", async () => {
    const { src, ui } = setup({
      phase: ref("judging"),
      submissions: ref({ p2: ["w2"], p1: ["w1"] }),
      revealedCards: ref({ p1: true }),
    });
    expect(ui.submissionIds.value).toEqual(["p1", "p2"]);
    expect(ui.revealedCount.value).toBe(1);
    ui.choosePendingWinner("p1");
    expect(ui.pendingWinner.value).toBeNull();

    src.revealedCards.value = { p1: true, p2: true };
    await nextTick();
    expect(ui.allRevealed.value).toBe(true);
    ui.choosePendingWinner("p1");
    expect(ui.pendingWinner.value).toBe("p1");
    ui.choosePendingWinner("p1"); // tap again = unselect
    expect(ui.pendingWinner.value).toBeNull();
    ui.choosePendingWinner("nobody");
    expect(ui.pendingWinner.value).toBeNull();
  });

  it("drops the pending winner if that submission disappears", async () => {
    const { src, ui } = setup({
      phase: ref("judging"),
      submissions: ref({ p1: ["w1"], p2: ["w2"] }),
      revealedCards: ref({ p1: true, p2: true }),
    });
    ui.choosePendingWinner("p2");
    src.submissions.value = { p1: ["w1"] };
    await nextTick();
    expect(ui.pendingWinner.value).toBeNull();
  });
});

describe("useRoundUi — canAdvance (Review Focus #3)", () => {
  it("is host-only, roundEnd-only, and reacts to a host hand-off", async () => {
    const { src, ui } = setup({ phase: ref("roundEnd") });
    expect(ui.canAdvance.value).toBe(false);
    src.isHost.value = true; // previous host left; this client inherits
    await nextTick();
    expect(ui.canAdvance.value).toBe(true);
    src.phase.value = "complete";
    await nextTick();
    expect(ui.canAdvance.value).toBe(false);
  });
});

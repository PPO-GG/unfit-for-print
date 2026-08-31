import { describe, expect, it } from "vitest";
import { applyUtteranceVolume } from "~/composables/useBrowserSpeech";

describe("applyUtteranceVolume", () => {
  it("scales the utterance volume by the user's TTS volume percentage", () => {
    const utterance = { volume: 1 } as SpeechSynthesisUtterance;

    applyUtteranceVolume(utterance, 40);

    expect(utterance.volume).toBeCloseTo(0.4);
  });

  it("clamps out-of-range percentages", () => {
    const utterance = { volume: 1 } as SpeechSynthesisUtterance;

    applyUtteranceVolume(utterance, -10);

    expect(utterance.volume).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { applyTtsVolume } from "~/composables/useSpeech";

describe("applyTtsVolume", () => {
  it("scales the audio element's volume by the user's TTS volume percentage", () => {
    const audio = { volume: 1 } as HTMLAudioElement;

    applyTtsVolume(audio, 40);

    expect(audio.volume).toBeCloseTo(0.4);
  });

  it("clamps out-of-range percentages", () => {
    const audio = { volume: 1 } as HTMLAudioElement;

    applyTtsVolume(audio, 150);

    expect(audio.volume).toBe(1);
  });
});

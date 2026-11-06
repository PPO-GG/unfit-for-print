import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { applyTtsVolume, useSpeech } from "~/composables/useSpeech";

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

describe("useSpeech with Kokoro", () => {
  const playMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    setActivePinia(createPinia());
    playMock.mockClear();
    // A `function`, not an arrow: the composable calls `new Audio()`.
    vi.stubGlobal(
      "Audio",
      vi.fn(function () {
        return { play: playMock, pause: vi.fn(), src: "", volume: 1, onended: null, onerror: null };
      }),
    );
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-audio");
    // useSpeech reads the store through Nuxt's auto-import, which the unit
    // environment does not provide.
    vi.stubGlobal("useUserPrefsStore", () => ({ ttsVoice: "kokoro-af_bella", ttsVolume: 70 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests the line through $activityFetch as a blob", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Blob(["a"], { type: "audio/mpeg" }));
    vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: mockFetch }));

    const { speak } = useSpeech();
    speak("kokoro", "Hello");
    await vi.waitFor(() => expect(playMock).toHaveBeenCalled());

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/kokoro-speak",
      expect.objectContaining({ method: "POST", responseType: "blob" }),
    );
  });

  it("moves on to the next line when a request fails", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("429"))
      .mockResolvedValueOnce(new Blob(["a"], { type: "audio/mpeg" }));
    vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: mockFetch }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { speak } = useSpeech();
    speak("kokoro", "First");
    speak("kokoro", "Second");
    await vi.waitFor(() => expect(playMock).toHaveBeenCalled());

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1]![1].body.text).toBe("Second");
  });
});

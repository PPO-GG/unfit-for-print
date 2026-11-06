import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useVoicePreview, PREVIEW_TTS_TEXT } from "~/composables/useVoicePreview";

describe("useVoicePreview", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("initializes with null activeVoiceId and false isLoading", () => {
    const { activeVoiceId, isLoading } = useVoicePreview();
    expect(activeVoiceId.value).toBeNull();
    expect(isLoading.value).toBe(false);
  });

  it("handles kokoro speech preview API call", async () => {
    const mockBlob = new Blob(["fake-audio"], { type: "audio/mpeg" });
    const mockFetch = vi.fn().mockResolvedValue(mockBlob);
    vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: mockFetch }));

    const playMock = vi.fn().mockResolvedValue(undefined);
    const pauseMock = vi.fn();
    // A `function`, not an arrow: the composable calls `new Audio(url)`, and
    // Vitest 4 refuses to construct a mock whose implementation is an arrow.
    const mockAudio = vi.fn(function () {
      return {
        play: playMock,
        pause: pauseMock,
        src: "",
        volume: 1,
        onended: null,
        onerror: null,
      };
    });
    global.Audio = mockAudio as any;
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-audio");
    global.URL.revokeObjectURL = vi.fn();

    const { activeVoiceId, playPreview, stopPreview } = useVoicePreview();

    await playPreview({
      provider: "kokoro",
      voiceId: "kokoro-af_bella",
      apiVoice: "af_bella",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/kokoro-speak",
      expect.objectContaining({
        method: "POST",
        responseType: "blob",
        body: {
          text: PREVIEW_TTS_TEXT,
          voice: "af_bella",
        },
      }),
    );
    expect(playMock).toHaveBeenCalled();
    expect(activeVoiceId.value).toBe("kokoro-af_bella");

    stopPreview();
    expect(activeVoiceId.value).toBeNull();
    expect(pauseMock).toHaveBeenCalled();
  });

  it("stops the preview and clears loading when the request fails", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("401"));
    vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: mockFetch }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { activeVoiceId, isLoading, playPreview } = useVoicePreview();
    await playPreview({
      provider: "kokoro",
      voiceId: "kokoro-af_bella",
      apiVoice: "af_bella",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(activeVoiceId.value).toBeNull();
    expect(isLoading.value).toBe(false);
  });
});

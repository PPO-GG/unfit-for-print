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
  });

  it("initializes with null activeVoiceId and false isLoading", () => {
    const { activeVoiceId, isLoading } = useVoicePreview();
    expect(activeVoiceId.value).toBeNull();
    expect(isLoading.value).toBe(false);
  });

  it("handles kokoro speech preview API call", async () => {
    const mockBlob = new Blob(["fake-audio"], { type: "audio/mpeg" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
    global.fetch = mockFetch;

    const playMock = vi.fn().mockResolvedValue(undefined);
    const pauseMock = vi.fn();
    const mockAudio = vi.fn().mockImplementation(() => ({
      play: playMock,
      pause: pauseMock,
      src: "",
      volume: 1,
      onended: null,
      onerror: null,
    }));
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
        body: JSON.stringify({
          text: PREVIEW_TTS_TEXT,
          voice: "af_bella",
        }),
      }),
    );
    expect(playMock).toHaveBeenCalled();
    expect(activeVoiceId.value).toBe("kokoro-af_bella");

    stopPreview();
    expect(activeVoiceId.value).toBeNull();
    expect(pauseMock).toHaveBeenCalled();
  });
});

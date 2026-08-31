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

  it("exports the expected preview text", () => {
    expect(PREVIEW_TTS_TEXT).toBe("This is a preview");
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
          text: "This is a preview",
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

  it("handles google speech preview API call", async () => {
    const mockBlob = new Blob(["fake-audio"], { type: "audio/mpeg" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
    global.fetch = mockFetch;

    const playMock = vi.fn().mockResolvedValue(undefined);
    const mockAudio = vi.fn().mockImplementation(() => ({
      play: playMock,
      pause: vi.fn(),
      src: "",
      volume: 1,
      onended: null,
      onerror: null,
    }));
    global.Audio = mockAudio as any;
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-audio");
    global.URL.revokeObjectURL = vi.fn();

    const { activeVoiceId, playPreview } = useVoicePreview();

    await playPreview({
      provider: "google",
      voiceId: "google-neural2-male",
      apiVoice: "en-US-Neural2-D",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/google-speak",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: "This is a preview",
          voiceName: "en-US-Neural2-D",
        }),
      }),
    );
    expect(activeVoiceId.value).toBe("google-neural2-male");
  });

  it("handles openai speech preview API call", async () => {
    const mockBlob = new Blob(["fake-audio"], { type: "audio/mpeg" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
    global.fetch = mockFetch;

    const playMock = vi.fn().mockResolvedValue(undefined);
    const mockAudio = vi.fn().mockImplementation(() => ({
      play: playMock,
      pause: vi.fn(),
      src: "",
      volume: 1,
      onended: null,
      onerror: null,
    }));
    global.Audio = mockAudio as any;
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-audio");
    global.URL.revokeObjectURL = vi.fn();

    const { activeVoiceId, playPreview } = useVoicePreview();

    await playPreview({
      provider: "openai",
      voiceId: "openai-fable",
      apiVoice: "fable",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/openai-speak",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: "This is a preview",
          voice: "fable",
          model: "tts-1",
        }),
      }),
    );
    expect(activeVoiceId.value).toBe("openai-fable");
  });

  it("handles elevenlabs speech preview API call", async () => {
    const mockBlob = new Blob(["fake-audio"], { type: "audio/mpeg" });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
    global.fetch = mockFetch;

    const playMock = vi.fn().mockResolvedValue(undefined);
    const mockAudio = vi.fn().mockImplementation(() => ({
      play: playMock,
      pause: vi.fn(),
      src: "",
      volume: 1,
      onended: null,
      onerror: null,
    }));
    global.Audio = mockAudio as any;
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-audio");
    global.URL.revokeObjectURL = vi.fn();

    const { activeVoiceId, playPreview } = useVoicePreview();

    await playPreview({
      provider: "elevenlabs",
      voiceId: "NuIlfu52nTXRM2NXDrjS",
      apiVoice: "NuIlfu52nTXRM2NXDrjS",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/speak",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: "This is a preview",
          voiceId: "NuIlfu52nTXRM2NXDrjS",
          modelId: "eleven_multilingual_v2",
        }),
      }),
    );
    expect(activeVoiceId.value).toBe("NuIlfu52nTXRM2NXDrjS");
  });
});

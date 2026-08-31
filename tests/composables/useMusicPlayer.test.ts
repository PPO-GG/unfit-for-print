import { beforeEach, describe, expect, it, vi } from "vitest";

describe("useMusicPlayer", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (window as any).YT;
    delete (window as any).onYouTubeIframeAPIReady;
    document.head.querySelectorAll("script").forEach((s) => s.remove());
    document.body.innerHTML = "";
  });

  it("clampVolume keeps values within the 0-100 range", async () => {
    const { clampVolume } = await import("~/composables/useMusicPlayer");

    expect(clampVolume(-10)).toBe(0);
    expect(clampVolume(150)).toBe(100);
    expect(clampVolume(42.6)).toBe(43);
  });

  it("buildPlayerVars requests the fixed playlist without autoplay or visible controls", async () => {
    const { buildPlayerVars } = await import("~/composables/useMusicPlayer");

    expect(buildPlayerVars("PL123")).toEqual({
      listType: "playlist",
      list: "PL123",
      autoplay: 0,
      controls: 0,
    });
  });

  it("creates exactly one YT.Player even when play() is called twice concurrently", async () => {
    const playerConstructor = vi.fn().mockImplementation((_id: string, config: any) => {
      const instance = { playVideo: vi.fn(), pauseVideo: vi.fn(), setVolume: vi.fn() };
      queueMicrotask(() => config.events.onReady());
      return instance;
    });
    (window as any).YT = {
      Player: playerConstructor,
      PlayerState: { PLAYING: 1, PAUSED: 2 },
    };
    document.body.innerHTML = '<div id="music-player-yt-target"></div>';

    const { useMusicPlayer } = await import("~/composables/useMusicPlayer");
    const music = useMusicPlayer();

    await Promise.all([music.play(), music.play()]);

    expect(playerConstructor).toHaveBeenCalledTimes(1);
  });

  it("applies a volume set before the player exists once it becomes ready", async () => {
    const instance = { playVideo: vi.fn(), pauseVideo: vi.fn(), setVolume: vi.fn() };
    (window as any).YT = {
      Player: vi.fn().mockImplementation((_id: string, config: any) => {
        queueMicrotask(() => config.events.onReady());
        return instance;
      }),
      PlayerState: { PLAYING: 1, PAUSED: 2 },
    };
    document.body.innerHTML = '<div id="music-player-yt-target"></div>';

    const { useMusicPlayer } = await import("~/composables/useMusicPlayer");
    const music = useMusicPlayer();

    music.setVolume(30);
    await music.play();

    expect(instance.setVolume).toHaveBeenCalledWith(30);
  });

  it("resets internal state after a failed player creation so a later play() can retry", async () => {
    let callCount = 0;
    const instance = { playVideo: vi.fn(), pauseVideo: vi.fn(), setVolume: vi.fn() };
    (window as any).YT = {
      Player: vi.fn().mockImplementation((_id: string, config: any) => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error("boom");
        }
        queueMicrotask(() => config.events.onReady());
        return instance;
      }),
      PlayerState: { PLAYING: 1, PAUSED: 2 },
    };
    document.body.innerHTML = '<div id="music-player-yt-target"></div>';

    const { useMusicPlayer } = await import("~/composables/useMusicPlayer");
    const music = useMusicPlayer();

    await expect(music.play()).rejects.toThrow("boom");
    await music.play();

    expect(instance.playVideo).toHaveBeenCalledTimes(1);
  });

  it("toggle() does not produce an unhandled rejection when player creation fails", async () => {
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      (window as any).YT = {
        Player: vi.fn().mockImplementation(() => {
          throw new Error("boom");
        }),
        PlayerState: { PLAYING: 1, PAUSED: 2 },
      };
      document.body.innerHTML = '<div id="music-player-yt-target"></div>';

      const { useMusicPlayer } = await import("~/composables/useMusicPlayer");
      const music = useMusicPlayer();

      music.toggle();

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(unhandledRejections).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
});

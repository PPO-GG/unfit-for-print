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
});

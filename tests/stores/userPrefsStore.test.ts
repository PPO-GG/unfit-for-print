import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUserPrefsStore } from "~/stores/userPrefsStore";

describe("userPrefsStore volume settings", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("defaults every volume channel to 70", () => {
    const prefs = useUserPrefsStore();
    expect(prefs.sfxVolume).toBe(70);
    expect(prefs.ttsVolume).toBe(70);
    expect(prefs.musicVolume).toBe(70);
  });

  it("clamps and rounds volume setters to the 0-100 range", () => {
    const prefs = useUserPrefsStore();

    prefs.setSfxVolume(150);
    prefs.setTtsVolume(-20);
    prefs.setMusicVolume(42.6);

    expect(prefs.sfxVolume).toBe(100);
    expect(prefs.ttsVolume).toBe(0);
    expect(prefs.musicVolume).toBe(43);
  });
});

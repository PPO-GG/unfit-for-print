import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Vue from "vue";
import { reactive } from "vue";
import SettingsSlideover from "~/components/SettingsSlideover.vue";

// SettingsSlideover.vue relies on Nuxt's auto-import of Vue reactivity APIs
// (computed) inside <script setup> — there are no explicit
// `import { computed } from "vue"` statements in the file. Plain vitest (no
// Nuxt auto-import plugin) compiles that to a bare global call, so it must
// be shimmed as a global here, matching the pattern used in
// tests/components/game/GameBoard.test.ts.
Object.assign(globalThis, Vue);

function mountSlideover({ compact = false } = {}) {
  const prefs = reactive({
    uiScale: 100,
    sfxVolume: 70,
    ttsVolume: 70,
    musicVolume: 70,
    setUiScale(v: number) {
      this.uiScale = v;
    },
    setSfxVolume(v: number) {
      this.sfxVolume = v;
    },
    setTtsVolume(v: number) {
      this.ttsVolume = v;
    },
    setMusicVolume(v: number) {
      this.musicVolume = v;
    },
  });
  const toggleMock = vi.fn();
  const notifyMock = vi.fn();

  vi.stubGlobal("useI18n", () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }));
  vi.stubGlobal("useUserPrefsStore", () => prefs);
  vi.stubGlobal("useMusicPlayer", () => ({
    play: vi.fn(),
    pause: vi.fn(),
    toggle: toggleMock,
    setVolume: vi.fn(),
    isPlaying: { value: false },
    hasError: { value: false },
  }));
  vi.stubGlobal("useNotifications", () => ({
    notify: notifyMock,
  }));
  vi.stubGlobal("useCompactLayout", () => ({
    isCompact: Vue.ref(compact),
  }));

  const wrapper = mount(SettingsSlideover, {
    props: { open: true },
    global: {
      stubs: {
        USlideover: {
          template: "<div data-testid='slideover'><slot name='content' /></div>",
        },
        UDrawer: {
          props: { close: Boolean },
          template:
            "<div data-testid='drawer' :data-close='String(close)'><slot name='body' /></div>",
        },
        UButton: { template: "<button v-bind=\"$attrs\"><slot /></button>" },
        UIcon: true,
        VoiceSwitcher: true,
        LanguageSwitcher: true,
        ThemeSwitcher: true,
      },
    },
  });

  return { wrapper, prefs, toggleMock, notifyMock };
}

describe("SettingsSlideover", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates the sfx volume preference when its slider changes", async () => {
    const { wrapper, prefs } = mountSlideover();

    await wrapper.get("[data-testid='sfx-volume-slider']").setValue(30);

    expect(prefs.sfxVolume).toBe(30);
  });

  it("calls music.toggle() when the play/pause button is clicked", async () => {
    const { wrapper, toggleMock } = mountSlideover();

    await wrapper.get("[data-testid='music-toggle-button']").trigger("click");

    expect(toggleMock).toHaveBeenCalledOnce();
  });

  it("uses the slideover on desktop", () => {
    const { wrapper } = mountSlideover();

    expect(wrapper.find("[data-testid='slideover']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='drawer']").exists()).toBe(false);
  });

  it("uses a closable bottom sheet on a phone", async () => {
    const { wrapper } = mountSlideover({ compact: true });
    // The sheet is gated on mount so SSR and hydration agree.
    await Vue.nextTick();

    const drawer = wrapper.get("[data-testid='drawer']");
    expect(drawer.attributes("data-close")).toBe("true");
    expect(wrapper.find("[data-testid='slideover']").exists()).toBe(false);

    await drawer.get("[data-testid='sfx-volume-slider']").setValue(25);
    expect(wrapper.find("[data-testid='music-toggle-button']").exists()).toBe(
      true,
    );
  });
});

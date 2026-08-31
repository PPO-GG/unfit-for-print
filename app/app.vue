<template>
  <UApp>
    <NuxtPwaManifest />
    <ClientOnly>
      <template v-if="!isDiscordActivity">
        <CustomCursor />
        <InstallPwaBanner />
      </template>
    </ClientOnly>
    <ConfirmDialog />
    <SettingsSlideover
      v-if="!isGameRoute"
      v-model:open="uiStore.showSettings"
    />
    <div
      style="position: fixed; width: 0; height: 0; overflow: hidden;"
      aria-hidden="true"
    >
      <div :id="MUSIC_PLAYER_CONTAINER_ID" />
    </div>
    <NuxtLayout>
      <div
        v-if="isDev"
        class="fixed top-0 left-0 border-t-1 h-0 border-amber-500 w-full z-50 items-center flex justify-start"
      >
        <span
          class="text-[0.5em] dark:text-white text-black font-mono mt-4 ml-1"
          >DEV MODE</span
        >
      </div>
      <NuxtPage :transition="pageTransition" />
    </NuxtLayout>
  </UApp>
</template>
<script lang="ts" setup>
import { useHead, useRuntimeConfig } from "#imports";
import { useUserPrefsStore } from "~/stores/userPrefsStore";
import { useUiStore } from "~/stores/uiStore";
import { MUSIC_PLAYER_CONTAINER_ID, useMusicPlayer } from "~/composables/useMusicPlayer";

const isDev = import.meta.env.DEV;
const config = useRuntimeConfig();
const route = useRoute();
const { isDiscordActivity } = useDiscordSDK();
const prefs = useUserPrefsStore();
const uiStore = useUiStore();
const music = useMusicPlayer();

const isGameRoute = computed(() => route.path.startsWith("/game/"));

// Apply global UI scale as a multiplier on top of the viewport-responsive
// root font-size (see the `html { font-size: clamp(...) }` rule in main.css).
// Setting a CSS variable — rather than a literal font-size — lets the two
// scaling systems compose instead of the user's preference overriding the
// 1080p/1440p/4K auto-scaling entirely.
watch(
  () => prefs.uiScale,
  (scale) => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "--ui-scale",
        `${scale / 100}`,
      );
    }
  },
  { immediate: true },
);

watch(
  () => prefs.musicVolume,
  (volume) => {
    if (import.meta.client) {
      music.setVolume(volume);
    }
  },
  { immediate: true },
);

// ─── Background Music Autoplay & First-Interaction Trigger ──────────
if (import.meta.client) {
  const startMusic = () => {
    if (!music.isPlaying.value) {
      music.play().catch(() => {
        // Ignored: browser may still be initializing or blocking
      });
    }
  };

  const onFirstUserInteraction = () => {
    startMusic();
    cleanupInteractionListeners();
  };

  const cleanupInteractionListeners = () => {
    window.removeEventListener("pointerdown", onFirstUserInteraction);
    window.removeEventListener("keydown", onFirstUserInteraction);
    window.removeEventListener("touchstart", onFirstUserInteraction);
  };

  function isTypingTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest("input, textarea, select, [contenteditable='true']"),
    );
  }

  const handleGlobalEsc = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || isGameRoute.value || isTypingTarget(e.target)) {
      return;
    }
    if (uiStore.showPolicy) {
      return;
    }
    if (!uiStore.showSettings) {
      uiStore.showSettings = true;
    }
  };

  onMounted(() => {
    // 1. Attempt immediate playback (works if browser/MEI allows unmuted autoplay)
    startMusic();

    // 2. Fallback: trigger on first click, tap, or keystroke
    window.addEventListener("pointerdown", onFirstUserInteraction, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", onFirstUserInteraction, {
      once: true,
      passive: true,
    });
    window.addEventListener("touchstart", onFirstUserInteraction, {
      once: true,
      passive: true,
    });

    // 3. Global ESC handler for settings
    window.addEventListener("keydown", handleGlobalEsc);
  });

  onBeforeUnmount(() => {
    cleanupInteractionListeners();
    window.removeEventListener("keydown", handleGlobalEsc);
  });
}

// Named CSS transition — enter/leave keyframes are defined in main.css
const pageTransition = {
  name: "page",
  mode: "out-in" as const,
};

// Default SEO meta — individual pages (e.g. game/[code].vue) override via useHead()
useHead({
  title: "Unfit for Print",
  meta: [
    {
      name: "description",
      content:
        "Join the chaos in Unfit for Print – a Cards Against Humanity-inspired party game!",
    },
    { property: "og:site_name", content: "Unfit for Print" },
    { property: "og:title", content: "Unfit for Print" },
    {
      property: "og:description",
      content:
        "Join or create your own card game lobbies and cause chaos with friends.",
    },
    { property: "og:type", content: "website" },
    { property: "og:url", content: config.public.baseUrl },
    { property: "og:image", content: `${config.public.baseUrl}/img/og.png` },
  ],
  link: [
    { rel: "canonical", href: config.public.baseUrl },
    {
      rel: "icon",
      type: "image/svg+xml",
      href: `${config.public.baseUrl}/img/ufp2.svg`,
    },
  ],
});
</script>

<!-- app/components/SettingsSlideover.vue -->
<script setup lang="ts">
import { createReusableTemplate, useMounted } from "@vueuse/core";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ "update:open": [boolean] }>();

const { t } = useI18n();
const prefs = useUserPrefsStore();
const music = useMusicPlayer();
const { notify } = useNotifications();

watch(
  () => music.hasError.value,
  (failed) => {
    if (failed) {
      notify({
        title: t("profile.settings_music_error", "Couldn't load music"),
        description: t(
          "profile.settings_music_error_desc",
          "The background music player failed to load. It may be blocked by an ad blocker or browser extension.",
        ),
        color: "error",
      });
    }
  },
);

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit("update:open", value),
});

// Desktop keeps the right-hand slideover. On a phone that panel is full width,
// so there is no backdrop left to tap and no Escape key, and the #content slot
// drops the slideover's own close button: the user was stuck. Phones get a
// bottom sheet instead, with a close button, a drag handle to swipe it away and
// a visible backdrop. Gated on mount so SSR (which can't see the viewport) and
// hydration agree on the desktop branch.
const { isCompact } = useCompactLayout();
const mounted = useMounted();
const useSheet = computed(() => mounted.value && isCompact.value);

const [DefineSettings, ReuseSettings] = createReusableTemplate();
</script>

<template>
  <DefineSettings>
    <!-- TTS Voice -->
    <div
      class="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-xs"
    >
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-sm font-medium">{{
          t("profile.settings_tts_voice")
        }}</span>
        <span class="text-xs text-slate-400">{{
          t("profile.settings_tts_voice_desc")
        }}</span>
      </div>
      <VoiceSwitcher />
    </div>

    <!-- Language -->
    <div
      class="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-xs"
    >
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-sm font-medium">{{
          t("profile.settings_language")
        }}</span>
        <span class="text-xs text-slate-400">{{
          t("profile.settings_language_desc")
        }}</span>
      </div>
      <LanguageSwitcher />
    </div>

    <!-- Theme -->
    <div
      class="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-xs"
    >
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-sm font-medium">{{
          t("profile.settings_theme")
        }}</span>
        <span class="text-xs text-slate-400">{{
          t("profile.settings_theme_desc")
        }}</span>
      </div>
      <ThemeSwitcher />
    </div>

    <!-- UI Scale -->
    <div
      class="flex flex-col gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-xs"
    >
      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-sm font-medium">{{
            t("game.ui_scale", "UI Scale")
          }}</span>
          <span class="text-xs text-slate-400">{{
            t(
              "profile.settings_ui_scale_desc",
              "Adjust the overall size of the interface",
            )
          }}</span>
        </div>
        <span class="text-sm font-semibold text-slate-200 tabular-nums"
          >{{ prefs.uiScale }}%</span
        >
      </div>
      <input
        type="range"
        data-vaul-no-drag
        :value="prefs.uiScale"
        min="75"
        max="150"
        step="5"
        class="settings-slider"
        data-testid="ui-scale-slider"
        @input="
          prefs.setUiScale(
            Number(($event.target as HTMLInputElement).value),
          )
        "
      />
      <div class="flex gap-2">
        <button
          v-for="preset in [100, 125, 150]"
          :key="preset"
          class="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer"
          :class="
            prefs.uiScale === preset
              ? 'bg-violet-500/20 border border-violet-500/50 text-violet-300'
              : 'bg-slate-700/50 border border-slate-600/30 text-slate-400 hover:bg-violet-500/10 hover:border-violet-500/30 hover:text-slate-200'
          "
          @click="prefs.setUiScale(preset)"
        >
          {{ preset }}%
        </button>
      </div>
    </div>

    <!-- Volume -->
    <div
      class="flex flex-col gap-4 p-4 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-xs"
    >
      <span class="text-sm font-medium">{{
        t("profile.settings_volume_heading")
      }}</span>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-sm">{{
              t("profile.settings_volume_sfx")
            }}</span>
            <span class="text-xs text-slate-400">{{
              t("profile.settings_volume_sfx_desc")
            }}</span>
          </div>
          <span class="text-sm font-semibold text-slate-200 tabular-nums"
            >{{ prefs.sfxVolume }}%</span
          >
        </div>
        <input
          type="range"
          data-vaul-no-drag
          :value="prefs.sfxVolume"
          min="0"
          max="100"
          step="1"
          class="settings-slider"
          data-testid="sfx-volume-slider"
          @input="
            prefs.setSfxVolume(
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-sm">{{
              t("profile.settings_volume_tts")
            }}</span>
            <span class="text-xs text-slate-400">{{
              t("profile.settings_volume_tts_desc")
            }}</span>
          </div>
          <span class="text-sm font-semibold text-slate-200 tabular-nums"
            >{{ prefs.ttsVolume }}%</span
          >
        </div>
        <input
          type="range"
          data-vaul-no-drag
          :value="prefs.ttsVolume"
          min="0"
          max="100"
          step="1"
          class="settings-slider"
          data-testid="tts-volume-slider"
          @input="
            prefs.setTtsVolume(
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-sm">{{
              t("profile.settings_volume_music")
            }}</span>
            <span class="text-xs text-slate-400">{{
              t("profile.settings_volume_music_desc")
            }}</span>
          </div>
          <span class="text-sm font-semibold text-slate-200 tabular-nums"
            >{{ prefs.musicVolume }}%</span
          >
        </div>
        <div class="flex items-center gap-3">
          <UButton
            size="sm"
            variant="soft"
            data-testid="music-toggle-button"
            :icon="
              music.isPlaying.value
                ? 'i-solar-pause-bold'
                : 'i-solar-play-bold'
            "
            @click="music.toggle()"
          >
            {{
              music.isPlaying.value
                ? t("profile.settings_music_pause")
                : t("profile.settings_music_play")
            }}
          </UButton>
          <input
            type="range"
            data-vaul-no-drag
            :value="prefs.musicVolume"
            min="0"
            max="100"
            step="1"
            class="settings-slider flex-1"
            data-testid="music-volume-slider"
            @input="
              prefs.setMusicVolume(
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
      </div>
    </div>
  </DefineSettings>

  <UDrawer
    v-if="useSheet"
    v-model:open="isOpen"
    direction="bottom"
    :title="t('profile.settings')"
    description="Adjust your voice, language, theme, and volume preferences"
    close
    :ui="{
      content: 'max-h-[90dvh]',
      body: 'flex flex-col gap-3 overflow-y-auto pb-[calc(1rem+var(--safe-bottom))]',
    }"
  >
    <template #body>
      <ReuseSettings />
    </template>
  </UDrawer>

  <USlideover
    v-else
    v-model:open="isOpen"
    :title="t('profile.settings')"
    description="Adjust your voice, language, theme, and volume preferences"
  >
    <template #content>
      <div class="p-4 sm:p-6 flex flex-col gap-3 overflow-y-auto">
        <ReuseSettings />
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.settings-slider {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(71, 85, 105, 0.4);
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.settings-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #8b5cf6;
  border: 2px solid rgba(139, 92, 246, 0.5);
  cursor: pointer;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.3);
}

.settings-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #8b5cf6;
  border: 2px solid rgba(139, 92, 246, 0.5);
  cursor: pointer;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.3);
}
</style>

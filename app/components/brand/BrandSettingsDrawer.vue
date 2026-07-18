<!--
  Slide-in settings drawer — port of settings.jsx's SettingsDrawer.

  Opened from:
    - BrandTopBar profile-menu → "Settings"
    - Keyboard: comma key on any brand page

  Multi-stage navigation:
    - root       → main preference list
    - tts        → TTS engine picker
    - tts-engine → voice list for the chosen engine
    - language   → app language picker

  State that needs to persist across sessions goes through userPrefsStore
  (pinia-plugin-persistedstate already wraps it). Things not yet in the
  store (music / sfx volume, reduceMotion) have been added.
-->
<template>
  <!-- Scrim -->
  <div
    class="settings-scrim"
    :style="{
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
    }"
    @click="close"
  />

  <!-- Drawer -->
  <aside
    class="settings-drawer"
    :class="{ open }"
    :aria-hidden="!open"
    role="dialog"
    :aria-label="t('brand.settings.aria')"
  >
    <!-- Header -->
    <div class="settings-header">
      <button
        v-if="stage !== 'root'"
        class="settings-back"
        :title="t('brand.settings.back')"
        @click="onBack"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2 L4 7 L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="flex-1">
        <div class="settings-eyebrow">{{ eyebrow }}</div>
        <div class="settings-title">{{ title }}</div>
      </div>
      <button class="settings-close" :title="t('brand.settings.close')" @click="close">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- Body -->
    <div class="settings-body hide-scroll">
      <!-- Root stage -->
      <div v-if="stage === 'root'" class="settings-stage-root">
        <div class="settings-section-label">{{ t("brand.settings.section_audio") }}</div>

        <button class="settings-drill" @click="stage = 'tts'">
          <span class="settings-drill-icon">🎙</span>
          <div class="settings-drill-body">
            <div class="settings-drill-label">{{ t("brand.settings.tts_voice") }}</div>
            <div class="settings-drill-value">{{ currentVoiceLabel }}</div>
          </div>
          <ChevronRight />
        </button>

        <VolumeRow
          icon="🎵"
          :label="t('brand.settings.music')"
          :vol="prefs.musicVol"
          :muted="prefs.musicMuted"
          @update:vol="prefs.setMusicVol"
          @update:muted="prefs.setMusicMuted"
        />
        <VolumeRow
          icon="🔔"
          :label="t('brand.settings.sfx')"
          :vol="prefs.sfxVol"
          :muted="prefs.sfxMuted"
          @update:vol="prefs.setSfxVol"
          @update:muted="prefs.setSfxMuted"
        />

        <div class="settings-section-label settings-section-label-spaced">
          {{ t("brand.settings.section_app") }}
        </div>

        <button class="settings-drill" @click="stage = 'language'">
          <span class="settings-drill-icon">{{ currentLangFlag }}</span>
          <div class="settings-drill-body">
            <div class="settings-drill-label">{{ t("brand.settings.language") }}</div>
            <div class="settings-drill-value">{{ currentLangName }}</div>
          </div>
          <ChevronRight />
        </button>

        <ToggleRow
          icon="✨"
          :label="t('brand.settings.reduce_motion')"
          :sub="t('brand.settings.reduce_motion_sub')"
          :value="prefs.reduceMotion"
          @update:value="prefs.setReduceMotion"
        />

        <div class="settings-section-label settings-section-label-spaced">
          {{ t("brand.settings.section_account") }}
        </div>

        <!-- Discord card — shown only when user is linked via Discord -->
        <div v-if="discordInfo" class="settings-discord">
          <div class="settings-discord-avatar">{{ discordInfo.initial }}</div>
          <div class="flex-1">
            <div class="settings-discord-name font-display">
              {{ discordInfo.name }}
              <span class="settings-discord-tag">{{ discordInfo.tag }}</span>
            </div>
            <div class="settings-discord-sub font-mono">
              {{ t("brand.settings.discord_linked_since", { year: discordInfo.year }) }}
            </div>
          </div>
          <span class="settings-discord-linked">LINKED</span>
        </div>

        <button class="settings-link-row" @click="onExport">
          <span class="settings-drill-icon">📤</span>
          <span class="flex-1 font-cond settings-link-label">
            {{ t("brand.settings.export_data") }}
          </span>
          <ChevronRight />
        </button>

        <button class="settings-link-row danger" @click="onSignOut">
          <span class="settings-drill-icon">🚪</span>
          <span class="flex-1 font-cond settings-link-label">
            {{ t("brand.settings.sign_out") }}
          </span>
          <ChevronRight />
        </button>
      </div>

      <!-- TTS engine stage -->
      <div v-else-if="stage === 'tts'" class="settings-stage-tts">
        <button
          v-for="engine in ttsEngines"
          :key="engine.id"
          class="settings-drill"
          :class="{ selected: engine.id === currentProviderType }"
          @click="onPickEngine(engine)"
        >
          <span class="settings-drill-icon settings-drill-icon-lg">{{ engine.icon }}</span>
          <div class="settings-drill-body">
            <div class="settings-drill-label">{{ engine.label }}</div>
            <div class="settings-drill-value">
              {{ engine.voices.length }} {{ t("brand.settings.voices") }}
            </div>
          </div>
          <span
            v-if="engine.id === currentProviderType"
            class="settings-active-pill"
          >{{ t("brand.settings.active") }}</span>
          <ChevronRight />
        </button>
      </div>

      <!-- TTS voice stage -->
      <div v-else-if="stage === 'tts-engine' && activeEngine" class="settings-stage-voices">
        <button
          v-for="v in activeEngine.voices"
          :key="v.id"
          class="settings-voice-row"
          :class="{ selected: prefs.ttsVoice === v.id }"
          @click="onPickVoice(v.id)"
        >
          <span class="settings-voice-radio" :class="{ selected: prefs.ttsVoice === v.id }">
            <svg v-if="prefs.ttsVoice === v.id" width="12" height="12" viewBox="0 0 12 12">
              <path d="M2 6 L5 9 L10 3" stroke="#0d0f1a" stroke-width="2" fill="none" stroke-linecap="round" />
            </svg>
          </span>
          <div class="flex-1">
            <div class="settings-drill-label">{{ v.name }}</div>
            <div class="settings-drill-value">{{ v.desc }}</div>
          </div>
        </button>
      </div>

      <!-- Language stage -->
      <div v-else-if="stage === 'language'" class="settings-stage-lang">
        <button
          v-for="l in availableLocales"
          :key="l.code"
          class="settings-drill"
          :class="{ selected: locale === l.code }"
          @click="onPickLocale(l.code)"
        >
          <span class="settings-drill-icon settings-drill-icon-lg">{{ l.flag }}</span>
          <div class="settings-drill-body">
            <div class="settings-drill-label">{{ l.name }}</div>
          </div>
          <span
            v-if="locale === l.code"
            class="settings-active-pill"
          >{{ t("brand.settings.active") }}</span>
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div class="settings-footer">
      <span>{{ t("brand.settings.auto_saved") }}</span>
      <span>v{{ version }}</span>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useUserStore } from "~/stores/userStore";
import { useUserPrefsStore } from "~/stores/userPrefsStore";
import { useNotifications } from "~/composables/useNotifications";
import {
  TTS_PROVIDERS,
  getProviderFromVoiceId,
  type TTSProviderType,
} from "~/constants/ttsProviders";
import ChevronRight from "~/components/brand/BrandSettingsChevron.vue";
import VolumeRow from "~/components/brand/BrandSettingsVolumeRow.vue";
import ToggleRow from "~/components/brand/BrandSettingsToggleRow.vue";

const { open, closeDrawer } = useBrandSettings();
const { t, locale, locales, setLocale, setLocaleCookie } = useI18n();
const userStore = useUserStore();
const prefs = useUserPrefsStore();
const { notify } = useNotifications();

type Stage = "root" | "tts" | "tts-engine" | "language";
const stage = ref<Stage>("root");

// Close helper (resets the stage on close so it's fresh next time)
function close() {
  closeDrawer();
  setTimeout(() => { stage.value = "root"; }, 300);
}

function onBack() {
  if (stage.value === "tts-engine") stage.value = "tts";
  else stage.value = "root";
}

// Reset stage when reopening.
watch(open, (isOpen) => {
  if (isOpen) stage.value = "root";
});

// ESC handling (global while the drawer is open) — back first, then close.
function onEscape(e: KeyboardEvent) {
  if (!open.value) return;
  if (e.key !== "Escape") return;
  if (stage.value === "root") close();
  else if (stage.value === "tts-engine") stage.value = "tts";
  else stage.value = "root";
}
onMounted(() => window.addEventListener("keydown", onEscape));
onBeforeUnmount(() => window.removeEventListener("keydown", onEscape));

// ─── TTS engine / voice mapping ────────────────────────────────
// Group all TTS_PROVIDERS voices into five buckets by provider type.
interface VoiceEntry { id: string; name: string; desc: string }
interface EngineEntry { id: TTSProviderType; label: string; icon: string; voices: VoiceEntry[] }

const ttsEngines = computed<EngineEntry[]>(() => {
  const buckets: Record<TTSProviderType, EngineEntry> = {
    openai: { id: "openai", label: t("brand.settings.engine_openai"), icon: "🤖", voices: [] },
    elevenlabs: { id: "elevenlabs", label: t("brand.settings.engine_elevenlabs"), icon: "👑", voices: [] },
    google: { id: "google", label: t("brand.settings.engine_google"), icon: "🌐", voices: [] },
    kokoro: { id: "kokoro", label: t("brand.settings.engine_kokoro"), icon: "🪶", voices: [] },
    browser: { id: "browser", label: t("brand.settings.engine_browser"), icon: "🖥", voices: [] },
  };

  for (const key in TTS_PROVIDERS) {
    const p = (TTS_PROVIDERS as Record<string, { id: string; apiVoice: string; displayName: string }>)[key]!;
    const provider = getProviderFromVoiceId(p.id);
    const bucket = buckets[provider];
    if (!bucket) continue;
    // Split "Google US Neural2-D (Male)" into friendly name + descriptor
    const m = /^(.+?)\s*\((.+)\)\s*$/.exec(p.displayName);
    const name = m?.[1]?.trim() ?? p.displayName;
    const desc = m?.[2]?.trim() ?? p.apiVoice;
    bucket.voices.push({ id: p.id, name, desc });
  }

  return Object.values(buckets).filter(b => b.voices.length > 0);
});

const currentProviderType = computed<TTSProviderType>(() => getProviderFromVoiceId(prefs.ttsVoice));

const currentEngine = computed<EngineEntry | undefined>(() =>
  ttsEngines.value.find(e => e.id === currentProviderType.value),
);

const currentVoice = computed<VoiceEntry | undefined>(() =>
  currentEngine.value?.voices.find(v => v.id === prefs.ttsVoice),
);

const currentVoiceLabel = computed<string>(() => {
  const engine = currentEngine.value?.label ?? "—";
  const voice = currentVoice.value?.name ?? "Default";
  return `${engine} · ${voice}`;
});

const activeEngineId = ref<TTSProviderType | null>(null);
const activeEngine = computed<EngineEntry | undefined>(() =>
  activeEngineId.value ? ttsEngines.value.find(e => e.id === activeEngineId.value) : undefined,
);

function onPickEngine(engine: EngineEntry) {
  activeEngineId.value = engine.id;
  stage.value = "tts-engine";
}

function onPickVoice(voiceId: string) {
  prefs.ttsVoice = voiceId;
}

// ─── Language ─────────────────────────────────────────────────
const LANG_FLAGS: Record<string, string> = {
  en: "🇺🇸", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", ja: "🇯🇵",
  pt: "🇧🇷", ru: "🇷🇺", ko: "🇰🇷", zh: "🇨🇳",
};

const availableLocales = computed(() =>
  locales.value.map((l: any) => ({
    code: l.code as string,
    name: l.name as string,
    flag: LANG_FLAGS[l.code] || "🌐",
  })),
);

const currentLangName = computed<string>(
  () => availableLocales.value.find(l => l.code === locale.value)?.name ?? "English",
);
const currentLangFlag = computed<string>(
  () => availableLocales.value.find(l => l.code === locale.value)?.flag ?? "🇺🇸",
);

async function onPickLocale(code: string) {
  if (code === locale.value) {
    stage.value = "root";
    return;
  }
  // Locales are strongly typed by @nuxtjs/i18n; we accept a loose
  // string from the UI and cast through `any` so the component
  // doesn't re-export the locale union.
  const typedCode = code as unknown as typeof locale.value;
  await setLocale(typedCode);
  setLocaleCookie(typedCode);
  prefs.setLanguage(code);
  stage.value = "root";
}

// ─── Discord linked card ──────────────────────────────────────
const discordInfo = computed(() => {
  const u = userStore.user;
  const prefsAny = u?.prefs as Record<string, any> | undefined;
  if (!u || !prefsAny?.discordUserId) return null;

  const name = u.name || "Player";
  const tagRaw = prefsAny.discordTag ?? prefsAny.discriminator ?? "";
  const tag = tagRaw ? `#${String(tagRaw).replace(/^#/, "")}` : "";
  const year = (() => {
    const created = u.$createdAt || (u as any).createdAt;
    if (!created) return new Date().getFullYear();
    return new Date(created).getFullYear();
  })();
  return {
    name,
    tag,
    year,
    initial: (name[0] || "D").toUpperCase(),
  };
});

// ─── Account actions ──────────────────────────────────────────
async function onSignOut() {
  try {
    await userStore.logout();
    close();
    notify({ title: t("notification.logged_out"), color: "success" });
  } catch (err) {
    console.error("[BrandSettingsDrawer] sign out", err);
    notify({ title: t("notification.logout_failed"), color: "error" });
  }
}

function onExport() {
  notify({
    title: t("brand.settings.export_soon_title"),
    description: t("brand.settings.export_soon_desc"),
    color: "info",
  });
}

// ─── Header copy ──────────────────────────────────────────────
const eyebrow = computed<string>(() => {
  switch (stage.value) {
    case "root": return t("brand.settings.eyebrow_root");
    case "tts": return t("brand.settings.eyebrow_tts");
    case "tts-engine": return `${t("brand.settings.eyebrow_tts_engine")} ${activeEngine.value?.label ?? ""}`;
    case "language": return t("brand.settings.eyebrow_language");
  }
  return "";
});

const title = computed<string>(() => {
  switch (stage.value) {
    case "root": return t("brand.settings.title_root");
    case "tts": return t("brand.settings.title_tts");
    case "tts-engine": return t("brand.settings.title_tts_engine");
    case "language": return t("brand.settings.title_language");
  }
  return "";
});

const version = __VERSION__;
</script>

<style scoped>
.flex-1 { flex: 1; min-width: 0; }

.settings-section-label-spaced { margin-top: 18px; }

.settings-stage-root { padding: 16px 14px; }
.settings-stage-tts,
.settings-stage-voices,
.settings-stage-lang { padding: 8px 14px; }

.settings-drill-icon-lg {
  font-size: 22px;
  width: 32px;
}

.settings-voice-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-top: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: background 140ms, border-color 140ms;
}
.settings-voice-row:hover { background: rgba(255, 255, 255, 0.03); }
.settings-voice-row.selected {
  border-color: var(--accent-3);
  background: rgba(120, 200, 255, 0.06);
}

.settings-voice-radio {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.settings-voice-radio.selected {
  background: var(--accent-3);
  border-color: var(--accent-3);
}

.settings-discord-name { font-size: 13px; text-transform: uppercase; }
.settings-discord-tag {
  color: var(--ink-muted);
  font-weight: 400;
  margin-left: 4px;
}

.settings-discord-sub {
  font-size: 9px;
  color: var(--ink-muted);
  letter-spacing: 0.12em;
  margin-top: 2px;
}

.settings-link-label {
  font-size: 14px;
  font-weight: 600;
}
</style>

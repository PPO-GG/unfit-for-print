<template>
  <div class="index-card-preview">
    <div class="index-card-preview-head">
      <div class="index-card-preview-head-left">
        <BrandChip>
          <BrandLiveDot :size="8" />
          Live Demo
        </BrandChip>
      </div>

      <div class="index-card-preview-controls">
        <button
          type="button"
          class="index-card-preview-iconbtn"
          :title="isSpeaking ? 'Stop' : 'Read these cards aloud'"
          :disabled="!canSpeak"
          @click="onSpeakClick"
        >
          <svg
            v-if="isSpeaking"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <rect x="3" y="3" width="10" height="10" rx="1" />
          </svg>
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
          </svg>
        </button>

        <button
          type="button"
          class="index-card-preview-shuffle font-mono"
          :disabled="isShuffling"
          @click="shuffle"
        >
          <BrandIcon
            name="shuffle"
            :size="14"
            :class="{ 'animate-spin': isShuffling }"
          />
          Shuffle
        </button>
      </div>
    </div>

    <div class="panel index-card-preview-stage">
      <div class="index-card-preview-cards">
        <div
          v-if="blackCard"
          class="index-card-preview-card"
          @click="blackFlipped = !blackFlipped"
        >
          <BlackCard
            :card-id="blackCard.$id"
            :text="blackCard.text"
            :card-pack="blackCard.pack"
            :num-pick="blackCard.pick"
            :flipped="blackFlipped"
            :three-deffect="true"
            :shine="true"
            :back-logo-url="'/img/ufp.svg'"
            :mask-url="'/img/textures/hexa.webp'"
            :scale="75"
          />
        </div>
        <div
          v-else
          class="index-card-preview-skeleton index-card-preview-skeleton-black"
        >
          <USkeleton class="h-3 w-[85%] bg-slate-600/40 mb-2" />
          <USkeleton class="h-3 w-[70%] bg-slate-600/40" />
        </div>

        <div
          v-if="whiteCard"
          class="index-card-preview-card"
          @click="whiteFlipped = !whiteFlipped"
        >
          <WhiteCard
            :card-id="whiteCard.$id"
            :text="whiteCard.text"
            :card-pack="whiteCard.pack"
            :flipped="whiteFlipped"
            :three-deffect="true"
            :shine="true"
            :back-logo-url="'/img/ufp.svg'"
            :mask-url="'/img/textures/hexa2.webp'"
            :scale="75"
          />
        </div>
        <div
          v-else
          class="index-card-preview-skeleton index-card-preview-skeleton-white"
        >
          <USkeleton class="h-3 w-[85%] bg-stone-400/40 mb-2" />
          <USkeleton class="h-3 w-[70%] bg-stone-400/40" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVibrate } from "@vueuse/core";
import { useCards } from "~/composables/useCards";
import { useSpeech } from "~/composables/useSpeech";
import { mergeCardText } from "~/composables/useMergeCards";
import { useUserPrefsStore } from "~/stores/userPrefsStore";
import { SFX } from "~/config/sfx.config";
import {
  TTS_PROVIDERS,
  getProviderFromVoiceId,
  type TTSProviderType,
} from "~/constants/ttsProviders";

const { fetchRandomCard } = useCards();
const userPrefs = useUserPrefsStore();
const { playSfx } = useSfx();
const { vibrate } = useVibrate({ pattern: [10, 7, 5], interval: 0 });
const isShuffling = ref(false);

const blackCard = ref<any>(null);
const whiteCard = ref<any>(null);
// Start flipped (face-down) so the reveal animation fires on first fetch.
const blackFlipped = ref(true);
const whiteFlipped = ref(true);

// ─── TTS wiring ────────────────────────────────────────────────
const openAIConfig = TTS_PROVIDERS.OPENAI;
const elevenLabsConfig = TTS_PROVIDERS.ELEVENLABS;

const speech =
  typeof window !== "undefined"
    ? useSpeech({
        elevenLabsVoiceId: elevenLabsConfig.apiVoice,
        openAIVoice: openAIConfig.apiVoice,
      })
    : {
        speak: (_provider: TTSProviderType, _text: string) => {},
        stop: () => {},
        isSpeaking: ref(false),
      };

const isSpeaking = computed(() => speech.isSpeaking.value);

const currentProvider = computed<TTSProviderType>(() =>
  getProviderFromVoiceId(userPrefs.ttsVoice),
);

const canSpeak = computed<boolean>(
  () => !!(blackCard.value?.text && whiteCard.value?.text),
);

function onSpeakClick() {
  if (isSpeaking.value) {
    speech.stop();
    return;
  }
  if (!canSpeak.value) return;
  const merged = mergeCardText(blackCard.value.text, whiteCard.value.text);
  if (!merged) return;
  speech.speak(currentProvider.value, merged);
}

// ─── Shuffle flow ──────────────────────────────────────────────
async function fetchSet() {
  try {
    const [black, white] = await Promise.all([
      fetchRandomCard("black", 1),
      fetchRandomCard("white"),
    ]);
    if (black) blackCard.value = black;
    if (white) whiteCard.value = white;
  } catch (err) {
    console.warn("[IndexCardPreview] fetch failed", err);
  }
}

async function shuffle() {
  if (isShuffling.value) return;
  isShuffling.value = true;

  // Flip both cards face-down; the reveal animation plays on re-flip.
  blackFlipped.value = true;
  whiteFlipped.value = true;

  if (typeof window !== "undefined") {
    try {
      await playSfx(SFX.cardThrow, { pitch: [0.8, 1.2], volume: 0.6 });
    } catch {
      /* sfx is cosmetic */
    }
    vibrate();
  }

  // Let the flip animation start before swapping card data.
  await new Promise((r) => setTimeout(r, 250));
  await fetchSet();

  // Reveal the new set.
  blackFlipped.value = false;
  whiteFlipped.value = false;

  // Lock the button briefly so the animation can settle.
  await new Promise((r) => setTimeout(r, 1000));
  isShuffling.value = false;
}

// ─── Lifecycle ─────────────────────────────────────────────────
onMounted(async () => {
  await fetchSet();
  // Initial reveal.
  blackFlipped.value = false;
  whiteFlipped.value = false;
});

onBeforeUnmount(() => {
  speech.stop();
});
</script>

<style scoped>
.index-card-preview {
  position: relative;
}

.index-card-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap: wrap;
}

.index-card-preview-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.index-card-preview-sub {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--ink-muted);
}

.index-card-preview-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.index-card-preview-iconbtn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.02);
  color: var(--ink-dim);
  transition:
    color 140ms,
    border-color 140ms,
    background 140ms;
}
.index-card-preview-iconbtn:hover:not(:disabled) {
  color: var(--ink);
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.05);
}
.index-card-preview-iconbtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.index-card-preview-shuffle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--ink-dim);
  background: transparent;
  border: none;
  padding: 4px 8px;
  transition: color 140ms;
}
.index-card-preview-shuffle:hover:not(:disabled) {
  color: #fff;
}
.index-card-preview-shuffle:disabled {
  opacity: 0.6;
  cursor: wait;
}

.animate-spin {
  animation: ipc-spin 1s linear infinite;
}
@keyframes ipc-spin {
  to {
    transform: rotate(360deg);
  }
}

.index-card-preview-stage {
  position: relative;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 340px;
}

.index-card-preview-cards {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.index-card-preview-card {
  cursor: pointer;
}

/* Fallback skeletons while the first fetch is in flight. Sized to
   approximately match the scale=65 cards so the layout doesn't jump. */
.index-card-preview-skeleton {
  width: clamp(7.5rem, 9vw, 13.5rem);
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  padding: 18px 14px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
.index-card-preview-skeleton-black {
  background: #1c2342;
  color: white;
}
.index-card-preview-skeleton-white {
  background: #e7e1de;
  box-shadow: inset 0 0 0 6px rgba(168, 162, 158, 0.5);
}
</style>

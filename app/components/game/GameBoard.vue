<script lang="ts" setup>
import type { Player } from "~/types/player";
import type { Lobby } from "~/types/lobby";
import { useUserStore } from "~/stores/userStore";
import { useLobby } from "~/composables/useLobby";
import { useNotifications } from "~/composables/useNotifications";
import BlackCardDeck from "~/components/game/BlackCardDeck.vue";
import WhiteCardDeck from "~/components/game/WhiteCardDeck.vue";
import GameTable from "~/components/game/GameTable.vue";
import GameOver from "~/components/game/GameOver.vue";
import GameHeader from "~/components/game/GameHeader.vue";
import { SFX } from "~/config/sfx.config";
import { useSpeech } from "~/composables/useSpeech";
import { useUserPrefsStore } from "@/stores/userPrefsStore";
import {
  TTS_PROVIDERS,
  getProviderFromVoiceId,
} from "~/constants/ttsProviders";

const { t } = useI18n();
const props = defineProps<{ lobby: Lobby; players: Player[] }>();
const emit = defineEmits<{
  (e: "leave"): void;
}>();

// ─── Y.Doc Reactive State ───────────────────────────────────────────────────
// All game state derived from useLobbyReactive — no Appwrite subscriptions.
const { leaveLobby, reactive: lobbyReactive, engine } = useLobby();

const state = computed(() => lobbyReactive.gameState.value);
const isSubmitting = lobbyReactive.isSubmitting;
const isJudging = lobbyReactive.isJudging;
const isRoundEnd = lobbyReactive.isRoundEnd;
const isComplete = lobbyReactive.isComplete;
const isJudge = lobbyReactive.isJudge;
const isHost = lobbyReactive.isHost;
const myHand = lobbyReactive.myHand;
const mySubmission = lobbyReactive.mySubmission;
const leaderboard = lobbyReactive.leaderboard;
const cardTexts = lobbyReactive.cardTexts;

const judgeId = computed(() => state.value?.judgeId ?? null);
const blackCard = computed(() => state.value?.blackCard ?? null);
const submissions = computed(() => state.value?.submissions ?? {});

const { playSfx } = useSfx();
const userStore = useUserStore();
const myId = userStore.user?.$id ?? "";
const { notify } = useNotifications();

// ── TTS (read-aloud broadcast) ──────────────────────────────────
type TTSProvider = "browser" | "elevenlabs" | "openai";
const userPrefs = useUserPrefsStore();

let speechService = {
  speak: (_provider: TTSProvider, _text: string) => {},
  isSpeaking: ref(false),
};

if (import.meta.client) {
  const openAIConfig = TTS_PROVIDERS.OPENAI;
  const elevenLabsConfig = TTS_PROVIDERS.ELEVENLABS;
  speechService = useSpeech({
    elevenLabsVoiceId: elevenLabsConfig.apiVoice,
    openAIVoice: openAIConfig.apiVoice,
  });
}

const currentProvider = computed(
  (): TTSProvider => getProviderFromVoiceId(userPrefs.ttsVoice),
);

const readingAloud = computed(() => {
  if (!import.meta.client) return false;
  return speechService.isSpeaking.value;
});

// Guard: prevent re-reading the same text on reconnects / hot-reloads.
// The text is stored as "<nonce>|<actual text>" so re-reading the same
// card produces a different state value.
let lastReadAloudNonce = "";

// Watch for readAloudText changes from ANY client (including the judge)
watch(
  () => state.value?.readAloudText,
  (raw) => {
    if (!raw || !import.meta.client) return;
    // Extract nonce and text: "<nonce>|<text>"
    const pipeIdx = raw.indexOf("|");
    const nonce = pipeIdx >= 0 ? raw.slice(0, pipeIdx) : "";
    const text = pipeIdx >= 0 ? raw.slice(pipeIdx + 1) : raw;
    if (nonce === lastReadAloudNonce) return;
    lastReadAloudNonce = nonce;
    speechService.speak(currentProvider.value, text);
  },
);

/** Judge triggers: broadcast readAloudText to all players via Y.Doc. */
function handleReadAloud(text: string) {
  if (!text) return;
  // Prefix with a timestamp nonce so re-reading the same card triggers a new state change
  const noncedText = `${Date.now()}|${text}`;
  engine.setReadAloud(noncedText);
}

// Add computed properties to check player type
const currentPlayer = computed(() => {
  return props.players.find((p) => p.userId === myId);
});

const isParticipant = computed(() => {
  return (
    currentPlayer.value?.playerType === "player" ||
    !currentPlayer.value?.playerType
  );
});

const isSpectator = computed(() => {
  return currentPlayer.value?.playerType === "spectator";
});

// Helper function to get player name from ID
const getPlayerName = (playerId: string): string => {
  const playerByUserId = props.players.find((p) => p.userId === playerId);
  if (playerByUserId?.name) return playerByUserId.name;
  const playerById = props.players.find((p) => p.$id === playerId);
  if (playerById?.name) return playerById.name;
  if (state.value?.players && state.value.players[playerId]) {
    return state.value.players[playerId];
  }
  return t("lobby.unknown_player");
};

// Track which cards have been revealed — synced via gameState
const revealedCards = computed<Record<string, boolean>>(() => {
  return state.value?.revealedCards || {};
});

function handleCardSubmit(cardIds: string[]) {
  const result = engine.playCard(cardIds);
  if (!result.success) {
    console.error("Failed to play card:", result.reason);
    notify({
      title: t("game.play_card_failed"),
      color: "error",
      icon: "i-mdi-alert-circle",
    });
  }
}

// ── Winner Flow ─────────────────────────────────────────────────
const winnerSelected = ref(false);
const localRoundWinner = ref<string | null>(null);
// Snapshot of the winner at the moment the server confirms.
// Immune to reactive state changes during the 2-second celebration delay.
const confirmedRoundWinner = ref<string | null>(null);
let nextRoundTimeout: NodeJS.Timeout | null = null;
let hasTriggeredNextRound = false;

// ── Next round via Y.Doc engine (synchronous, no retry needed) ──────
function tryStartNextRound(): boolean {
  const result = engine.nextRound();
  if (result.success) {
    playSfx(SFX.cardShuffle, { volume: 0.4 });
  } else {
    console.warn("[GameBoard] next-round failed:", result.reason);
  }
  return result.success;
}

// ── Phase staleness watchdog ────────────────────────────────
// If the game stays stuck in roundEnd (all retries exhausted during a
// transient outage that later resolves), periodically re-attempt.
let stalePhaseInterval: NodeJS.Timeout | null = null;

function startStalePhaseWatchdog() {
  stopStalePhaseWatchdog();
  stalePhaseInterval = setInterval(() => {
    if (
      isHost.value &&
      isRoundEnd.value &&
      !isComplete.value &&
      !hasTriggeredNextRound
    ) {
      console.info("[GameBoard] Watchdog: retrying stuck next-round…");
      hasTriggeredNextRound = true;
      const ok = tryStartNextRound();
      if (ok) {
        stopStalePhaseWatchdog();
        if (!isComplete.value) winnerSelected.value = false;
      } else {
        hasTriggeredNextRound = false;
      }
    } else if (!isRoundEnd.value) {
      stopStalePhaseWatchdog();
    }
  }, 10_000);
}

function stopStalePhaseWatchdog() {
  if (stalePhaseInterval) {
    clearInterval(stalePhaseInterval);
    stalePhaseInterval = null;
  }
}

const effectiveRoundWinner = computed(() => {
  return localRoundWinner.value || state.value?.roundWinner || null;
});

// The active game phase for the GameTable component
// During roundEnd, keep showing as "judging" so the cards/celebration stay visible.
// IMPORTANT: "submitting-complete" must stay as "submitting" — it's a brief 500ms
// window after the last card is submitted. If we switch to "judging" prematurely,
// the GameTable's pile cards disappear before the FLIP animation can capture their
// positions, causing a blank screen instead of the pile→grid spread animation.
const activePhase = computed<"submitting" | "judging">(() => {
  const phase = state.value?.phase;
  if (isJudging.value || isRoundEnd.value || isComplete.value) return "judging";
  return "submitting";
});

// Watch for roundWinner from the server
watch(
  () => state.value?.roundWinner,
  (newWinner) => {
    if (newWinner) {
      // Clear local optimistic winner since server confirmed
      localRoundWinner.value = null;

      // Snapshot the winner ID so the celebration overlay is immune
      // to reactive state changes during the 2-second delay.
      confirmedRoundWinner.value = newWinner;

      // Play sound effect (skip for judge — they already heard it in handleSelectWinner)
      if (!isJudge.value) {
        playSfx(SFX.selectWinner, { pitch: [0.95, 1.05], volume: 0.75 });
      }

      // Show the celebration after a brief delay to let winning card highlight
      setTimeout(() => {
        winnerSelected.value = true;

        // Play round-win fanfare when the celebration overlay appears
        playSfx(SFX.winRound, { volume: 0.25 });

        // Auto-start next round after 5 seconds
        hasTriggeredNextRound = false;
        if (nextRoundTimeout) clearTimeout(nextRoundTimeout);

        nextRoundTimeout = setTimeout(() => {
          if (isHost.value && !hasTriggeredNextRound && !isComplete.value) {
            hasTriggeredNextRound = true;
            const ok = tryStartNextRound();
            if (ok) {
              if (!isComplete.value) winnerSelected.value = false;
            } else {
              hasTriggeredNextRound = false;
              startStalePhaseWatchdog();
            }
          } else if (!isComplete.value) {
            // Non-host: schedule a fallback attempt in case host is unavailable.
            // nextRound() is idempotent — first client to succeed transitions the
            // phase; subsequent calls return { success: false } harmlessly.
            winnerSelected.value = false;
            if (!hasTriggeredNextRound) {
              setTimeout(() => {
                if (
                  isRoundEnd.value &&
                  !isComplete.value &&
                  !hasTriggeredNextRound
                ) {
                  console.info(
                    "[GameBoard] Non-host fallback: advancing stuck round",
                  );
                  hasTriggeredNextRound = true;
                  const ok = tryStartNextRound();
                  if (ok) {
                    if (!isComplete.value) winnerSelected.value = false;
                  } else {
                    hasTriggeredNextRound = false;
                  }
                }
              }, 3000);
            }
          }
        }, 5000);
      }, 2000); // 2s delay to show winning card highlight before celebration
    }
  },
);

// Reset winner state when round changes
watch(
  () => state.value?.round,
  () => {
    winnerSelected.value = false;
    localRoundWinner.value = null;
    confirmedRoundWinner.value = null;
    hasTriggeredNextRound = false;
    stopStalePhaseWatchdog();
  },
);

function handleSelectWinner(playerId: string) {
  // First mark the winner locally for immediate feedback
  localRoundWinner.value = playerId;

  // Mutate Y.Doc — triggers the watch above for all players via sync
  const result = engine.selectWinner(playerId);
  if (!result.success) {
    console.error("Failed to select winner:", result.reason);
    localRoundWinner.value = null;
    return;
  }

  // Play sound effect for the judge only
  playSfx(SFX.selectWinner, { pitch: [0.95, 1.05], volume: 0.75 });
}

// Reveal a card — direct Y.Doc mutation
function revealCard(playerId: string) {
  if (revealedCards.value[playerId]) return;
  const result = engine.revealCard(playerId);
  if (!result.success) {
    console.error("Failed to reveal card:", result.reason);
  }
}

// Clean up on unmount
onUnmounted(() => {
  if (nextRoundTimeout) clearTimeout(nextRoundTimeout);
  stopStalePhaseWatchdog();
});

// Convert spectator to player — direct Y.Doc mutation
function convertToPlayer(playerId: string) {
  if (!isHost.value) return;

  const result = engine.convertToPlayer(playerId);
  if (result.success) {
    notify({
      title: t("game.player_dealt_in"),
      description: t("game.player_dealt_in_description", {
        name: getPlayerName(playerId),
      }),
      color: "success",
      icon: "i-mdi-account-plus",
    });
  } else {
    console.error("Failed to convert spectator:", result.reason);
    notify({
      title: t("game.error_player_dealt_in"),
      color: "error",
      icon: "i-mdi-alert",
    });
  }
}

function handleLeave() {
  const nuxtApp = useNuxtApp();
  nuxtApp.payload.state.selfLeaving = true;
  leaveLobby(props.lobby.$id, myId);
  emit("leave");
}
</script>
<template>
  <div
    class="w-full bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen flex flex-col"
  >
    <div
      class="fixed w-full inset-0 bg-[url('/img/textures/noise.png')] opacity-7 pointer-events-none"
    ></div>

    <!-- Main Content -->
    <div class="min-h-screen flex flex-col">
      <GameHeader
        :state="state as any"
        :is-submitting="isSubmitting"
        :is-judging="isJudging"
        :judge-id="judgeId ?? undefined"
        :players="props.players"
      />

      <main class="flex-1 p-2 md:p-6 flex flex-col overflow-hidden relative">
        <!-- Card Decks — flanking left/right, out of document flow -->
        <div class="absolute left-10 top-10 z-10">
          <BlackCardDeck :black-card="blackCard ?? undefined" />
        </div>
        <div class="absolute right-10 top-10 z-10">
          <WhiteCardDeck />
        </div>

        <!-- Unified Game Table (submission + judging + winner celebration) -->
        <GameTable
          v-if="isSubmitting || isJudging || isRoundEnd || isComplete"
          :is-judge="isJudge"
          :submissions="submissions"
          :my-id="myId"
          :black-card="blackCard"
          :my-hand="myHand"
          :is-participant="isParticipant"
          :is-spectator="isSpectator"
          :is-host="isHost"
          :players="props.players"
          :phase="activePhase"
          :revealed-cards="revealedCards"
          :effective-round-winner="effectiveRoundWinner"
          :confirmed-round-winner="confirmedRoundWinner"
          :winner-selected="winnerSelected"
          :winning-cards="state?.winningCards || []"
          :scores="state?.scores || {}"
          :judge-id="judgeId"
          :reading-aloud="readingAloud"
          :card-texts="cardTexts"
          @select-cards="handleCardSubmit"
          @convert-to-player="convertToPlayer"
          @select-winner="handleSelectWinner"
          @reveal-card="revealCard"
          @read-aloud="handleReadAloud"
        />

        <!-- Waiting State -->
        <div
          v-else-if="!isComplete"
          class="text-center italic text-gray-500 mt-10"
        >
          {{ t("game.waiting") }}
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.card-deck {
  position: absolute;
  z-index: 10;
  top: 0.5rem;
}

.card-deck--black {
  left: 0.5rem;
}

.card-deck--white {
  right: 0.5rem;
}

@media (min-width: 768px) {
  .card-deck {
    top: 0.75rem;
  }

  .card-deck--black {
    left: 1rem;
  }

  .card-deck--white {
    right: 1rem;
  }
}

@media (min-width: 1280px) {
  .card-deck {
    top: 1rem;
  }

  .card-deck--black {
    left: 1.5rem;
  }

  .card-deck--white {
    right: 1.5rem;
  }
}
</style>

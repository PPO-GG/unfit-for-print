import { readonly, ref } from "vue";
import { makeClientRef } from "~/utils/clientRef";
import {
  incrementGamesCompleted,
  isPromptSuppressed,
  markDismissed,
  markRated,
} from "~/utils/feedbackCadence";
import { useFeedbackModal } from "~/composables/useFeedbackModal";
import { useFeedbackSender } from "~/composables/useFeedbackSender";

export type PromptStage = "hidden" | "ask" | "thanks";

// Module state, not useState: the card in app.vue and the game page must
// share it, and only the client ever writes it (offer() runs from a
// client-side watcher), so nothing leaks between SSR requests.
const stage = ref<PromptStage>("hidden");
const rating = ref<number | null>(null);
const clientRef = ref<string | null>(null);
const lobbyCode = ref<string | null>(null);
const offeredGames = new Set<string>();

/**
 * The game-over rating card. All eligibility and cadence decisions live
 * here so FeedbackPrompt.vue stays presentational.
 */
export function useFeedbackPrompt() {
  const { send } = useFeedbackSender();
  // Resolved at call time: tellMore runs from a click, outside Nuxt context.
  const { open: openModal } = useFeedbackModal();

  function offer(o: { lobbyCode: string; gameEndTime: number | null; isSpectator: boolean }) {
    const key = `${o.lobbyCode}:${o.gameEndTime ?? "unknown"}`;
    if (offeredGames.has(key)) return;
    offeredGames.add(key);
    if (o.isSpectator) return;

    incrementGamesCompleted();
    if (isPromptSuppressed()) return;

    clientRef.value = makeClientRef();
    rating.value = null;
    lobbyCode.value = o.lobbyCode;
    stage.value = "ask";
  }

  function rate(stars: number) {
    if (stage.value !== "ask" || !clientRef.value) return;
    rating.value = stars;
    markRated();
    send({
      clientRef: clientRef.value,
      rating: stars,
      source: "game_over_prompt",
      lobbyCode: lobbyCode.value,
    });
    stage.value = "thanks";
  }

  function dismiss() {
    if (stage.value === "ask") markDismissed();
    stage.value = "hidden";
  }

  function done() {
    stage.value = "hidden";
  }

  function tellMore() {
    openModal({
      mode: "idea",
      rating: rating.value,
      clientRef: clientRef.value,
      source: "game_over_prompt",
      lobbyCode: lobbyCode.value,
    });
    stage.value = "hidden";
  }

  /** Leaving the game route: drop the card without counting a dismissal. */
  function hide() {
    stage.value = "hidden";
  }

  return { stage: readonly(stage), offer, rate, dismiss, done, tellMore, hide };
}

/** Test seam. */
export function __resetFeedbackPrompt(): void {
  stage.value = "hidden";
  rating.value = null;
  clientRef.value = null;
  lobbyCode.value = null;
  offeredGames.clear();
}

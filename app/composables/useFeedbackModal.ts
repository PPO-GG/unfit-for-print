import type { FeedbackSource } from "#shared/feedback";

export type FeedbackMode = "broken" | "idea";

export interface FeedbackModalState {
  mode: FeedbackMode;
  rating: number | null;
  clientRef: string | null;
  source: FeedbackSource;
  lobbyCode: string | null;
}

export type FeedbackModalOptions = Partial<FeedbackModalState>;

const DEFAULTS: FeedbackModalState = {
  mode: "idea",
  rating: null,
  clientRef: null,
  source: "feedback_modal",
  lobbyCode: null,
};

/**
 * Shared open state for the merged "Send feedback" modal. Its entry points
 * sit in different component trees — the home footer, the in-game ESC menu,
 * the phone lobby sheet and the game-over prompt card — so the flag is
 * global, and the modal is mounted once in app.vue.
 */
export function useFeedbackModal() {
  const isOpen = useState("feedback-modal-open", () => false);
  const options = useState<FeedbackModalState>("feedback-modal-options", () => ({ ...DEFAULTS }));

  function open(o: FeedbackModalOptions = {}) {
    options.value = { ...DEFAULTS, ...o };
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  return { isOpen, options, open, close };
}

export default useFeedbackModal;

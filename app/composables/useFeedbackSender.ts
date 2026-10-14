import type { FeedbackSource, FeedbackTopic } from "#shared/feedback";
import { readGamesCompleted } from "~/utils/feedbackCadence";

export interface FeedbackSendInput {
  clientRef: string;
  rating?: number | null;
  topics?: FeedbackTopic[];
  message?: string | null;
  source: FeedbackSource;
  lobbyCode?: string | null;
}

/**
 * Fire and forget: synchronous, never throws, never surfaces an error. A
 * lost rating is not worth interrupting a player over. Goes through
 * $activityFetch so a Discord Activity player's identity is attached.
 */
export function useFeedbackSender() {
  const send = (input: FeedbackSendInput): void => {
    try {
      const { $activityFetch } = useNuxtApp();
      void $activityFetch("/api/feedback", {
        method: "POST",
        keepalive: true,
        body: {
          ...input,
          platform:
            typeof window !== "undefined" &&
            window.location.hostname.includes("discordsays")
              ? "discord-activity"
              : "web",
          appVersion: useRuntimeConfig().public.appVersion,
          gamesCompletedHint: readGamesCompleted(),
        },
      }).catch(() => {});
    } catch {
      // Deliberately silent; see above.
    }
  };

  return { send };
}

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

type ActivityFetch = (url: string, opts: Record<string, unknown>) => Promise<unknown>;

/**
 * Fire and forget: synchronous, never throws, never surfaces an error. A
 * lost rating is not worth interrupting a player over. Goes through
 * $activityFetch so a Discord Activity player's identity is attached.
 *
 * Nuxt context is resolved when the composable is called (setup time), not
 * inside send(): a click handler runs outside any Nuxt context, and a
 * lookup there would silently drop every rating.
 */
export function useFeedbackSender() {
  let activityFetch: ActivityFetch | null = null;
  let appVersion: string | null = null;
  try {
    activityFetch = (useNuxtApp().$activityFetch as ActivityFetch | undefined) ?? null;
    appVersion = (useRuntimeConfig().public.appVersion as string | undefined) ?? null;
  } catch {
    // No usable context: send() becomes a no-op rather than throwing here.
  }

  const send = (input: FeedbackSendInput): void => {
    if (!activityFetch) return;
    try {
      void activityFetch("/api/feedback", {
        method: "POST",
        keepalive: true,
        body: {
          ...input,
          platform:
            typeof window !== "undefined" &&
            window.location.hostname.includes("discordsays")
              ? "discord-activity"
              : "web",
          appVersion,
          gamesCompletedHint: readGamesCompleted(),
        },
      }).catch(() => {});
    } catch {
      // Deliberately silent; see above.
    }
  };

  return { send };
}

import type { IssueContext, IssueKind } from "~/types/issue";

const DEDUPE_WINDOW_MS = 60_000;
const SESSION_CAP = 20;

// Module scope, not per-call: the caps have to hold across every component
// that reports, otherwise each caller gets its own fresh budget and the
// "cap" caps nothing.
const recentlySent = new Map<string, number>();
let sentThisSession = 0;
let contextProvider: (() => IssueContext & { lobbyCode?: string }) | null = null;

/** Cheap client-side key. Not the server fingerprint — this only has to stop
 *  the same error firing twice a second from a render loop. */
function dedupeKey(kind: string, message: string): string {
  return `${kind}|${message.slice(0, 200)}`;
}

export const useIssueReporter = () => {
  /**
   * Registers the callback that supplies live game state. `useLobby` sets
   * this on connect and clears it on teardown, which is what makes captured
   * errors reconstructable rather than just "undefined is not an object".
   */
  const registerContextProvider = (
    fn: (() => IssueContext & { lobbyCode?: string }) | null,
  ): void => {
    contextProvider = fn;
  };

  /**
   * Fire and forget. Synchronous, never throws, never rejects.
   *
   * Posts with plain $fetch rather than $activityFetch on purpose: this runs
   * inside error handlers, and routing it through a wrapper that could
   * itself fail would risk recursing until the tab dies.
   */
  const report = (input: {
    kind: IssueKind;
    message: string;
    stack?: string;
    context?: IssueContext;
  }): void => {
    try {
      if (sentThisSession >= SESSION_CAP) return;

      const now = Date.now();
      const key = dedupeKey(input.kind, input.message);
      const last = recentlySent.get(key);
      if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return;
      recentlySent.set(key, now);
      sentThisSession += 1;

      let ambient: (IssueContext & { lobbyCode?: string }) | null = null;
      try {
        ambient = contextProvider ? contextProvider() : null;
      } catch {
        // A provider that throws mid-teardown must not cost us the report.
        ambient = null;
      }

      const { lobbyCode, ...ambientContext } = ambient ?? {};

      void $fetch("/api/issues/report", {
        method: "POST",
        keepalive: true,
        body: {
          kind: input.kind,
          message: input.message,
          stack: input.stack,
          lobbyCode,
          route: typeof window !== "undefined" ? window.location.pathname : undefined,
          platform:
            typeof window !== "undefined" && window.location.hostname.includes("discordsays")
              ? "discord-activity"
              : "web",
          appVersion: useRuntimeConfig().public.appVersion,
          context: { ...ambientContext, ...(input.context ?? {}) },
        },
      }).catch(() => {
        // Deliberately silent. Nothing useful can be done with a failed
        // error report, and surfacing it would start the loop this whole
        // module exists to avoid.
      });
    } catch {
      // Same reasoning, for anything the block above did not anticipate.
    }
  };

  /** Test seam: forget the caps and the provider. */
  const __reset = (): void => {
    recentlySent.clear();
    sentThisSession = 0;
    contextProvider = null;
  };

  return { report, registerContextProvider, __reset };
};

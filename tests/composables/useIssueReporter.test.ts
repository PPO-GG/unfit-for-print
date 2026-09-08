import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIssueReporter } from "~/composables/useIssueReporter";

beforeEach(() => {
  const { __reset } = useIssueReporter();
  __reset();
  // @ts-ignore — the composable posts through the global $fetch
  globalThis.$fetch = vi.fn().mockResolvedValue(null);
  // @ts-ignore
  globalThis.useRuntimeConfig = () => ({ public: { appVersion: "3.19.0" } });
});

describe("useIssueReporter", () => {
  it("posts a report to the ingest route", () => {
    const { report } = useIssueReporter();
    report({ kind: "client-error", message: "boom" });

    expect(globalThis.$fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (globalThis.$fetch as any).mock.calls[0];
    expect(url).toBe("/api/issues/report");
    expect(options.body.message).toBe("boom");
    expect(options.body.appVersion).toBe("3.19.0");
  });

  it("drops a duplicate of the same error inside the dedupe window", () => {
    const { report } = useIssueReporter();
    report({ kind: "client-error", message: "boom" });
    report({ kind: "client-error", message: "boom" });

    expect(globalThis.$fetch).toHaveBeenCalledTimes(1);
  });

  it("still sends a genuinely different error", () => {
    const { report } = useIssueReporter();
    report({ kind: "client-error", message: "boom" });
    report({ kind: "client-error", message: "different" });

    expect(globalThis.$fetch).toHaveBeenCalledTimes(2);
  });

  it("stops after the session cap", () => {
    const { report } = useIssueReporter();
    for (let i = 0; i < 25; i++) {
      report({ kind: "client-error", message: `boom ${i}` });
    }
    expect((globalThis.$fetch as any).mock.calls.length).toBe(20);
  });

  it("merges the registered context provider under explicit context", () => {
    const { report, registerContextProvider } = useIssueReporter();
    registerContextProvider(() => ({ phase: "judging", lobbyCode: "AB2C" }));

    report({ kind: "client-error", message: "boom", context: { phase: "roundEnd" } });

    const [, options] = (globalThis.$fetch as any).mock.calls[0];
    expect(options.body.lobbyCode).toBe("AB2C");
    expect(options.body.context.phase).toBe("roundEnd"); // explicit wins
  });

  // The single most important test in this file. report() runs inside error
  // handlers; if it can throw, it is an infinite loop that kills the tab.
  it("never throws when the transport fails", () => {
    // @ts-ignore
    globalThis.$fetch = vi.fn().mockRejectedValue(new Error("network down"));
    const { report } = useIssueReporter();
    expect(() => report({ kind: "client-error", message: "boom" })).not.toThrow();
  });

  it("never throws when the context provider itself throws", () => {
    const { report, registerContextProvider } = useIssueReporter();
    registerContextProvider(() => {
      throw new Error("lobby torn down mid-report");
    });
    expect(() => report({ kind: "client-error", message: "boom" })).not.toThrow();
  });
});

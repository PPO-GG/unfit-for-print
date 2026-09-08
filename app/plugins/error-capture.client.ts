// Routes every unhandled client error into useIssueReporter. Sits alongside
// analytics.client.ts, which is a no-op $analytics shim (Rybbit, disabled) —
// this plugin is unrelated to it and does not depend on it.
import { defineNuxtPlugin } from "#app";

export default defineNuxtPlugin((nuxtApp) => {
  const { report } = useIssueReporter();

  const describe = (err: unknown): { message: string; stack?: string } => {
    if (err instanceof Error) {
      return { message: err.message || err.name, stack: err.stack };
    }
    return { message: String(err) };
  };

  nuxtApp.hook("vue:error", (err) => {
    report({ kind: "client-error", ...describe(err) });
  });

  nuxtApp.hook("app:error", (err) => {
    report({ kind: "client-error", ...describe(err) });
  });

  window.addEventListener("error", (evt) => {
    report({ kind: "client-error", ...describe(evt.error ?? evt.message) });
  });

  window.addEventListener("unhandledrejection", (evt) => {
    report({ kind: "client-error", ...describe(evt.reason) });
  });
});

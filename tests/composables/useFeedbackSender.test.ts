import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFeedbackSender } from "~/composables/useFeedbackSender";
import { GAMES_KEY } from "~/utils/feedbackCadence";

const input = {
  clientRef: "11111111-1111-4111-8111-111111111111",
  rating: 4,
  source: "game_over_prompt" as const,
  lobbyCode: "AB2C",
};

function stubNuxt(activityFetch: unknown) {
  vi.stubGlobal("useNuxtApp", () => ({ $activityFetch: activityFetch }));
  vi.stubGlobal("useRuntimeConfig", () => ({ public: { appVersion: "9.9.9" } }));
}

function stubHostname(hostname: string) {
  vi.stubGlobal("location", { ...window.location, hostname });
}

beforeEach(() => {
  localStorage.clear();
  stubHostname("unfit.cards");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useFeedbackSender", () => {
  it("POSTs the input with platform, version and games hint", () => {
    localStorage.setItem(GAMES_KEY, "3");
    const fetch = vi.fn().mockResolvedValue({});
    stubNuxt(fetch);

    useFeedbackSender().send(input);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0]!;
    expect(url).toBe("/api/feedback");
    expect(opts.method).toBe("POST");
    expect(opts.keepalive).toBe(true);
    expect(opts.body).toEqual({
      ...input,
      platform: "web",
      appVersion: "9.9.9",
      gamesCompletedHint: 3,
    });
  });

  it("reports discord-activity inside a discordsays host", () => {
    const fetch = vi.fn().mockResolvedValue({});
    stubNuxt(fetch);
    stubHostname("123456.discordsays.com");

    useFeedbackSender().send(input);

    expect(fetch.mock.calls[0]![1].body.platform).toBe("discord-activity");
  });

  it("does not throw when $activityFetch throws synchronously", () => {
    stubNuxt(() => {
      throw new Error("boom");
    });
    const { send } = useFeedbackSender();
    expect(() => send(input)).not.toThrow();
  });

  it("swallows a rejected request (no unhandled rejection)", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      stubNuxt(vi.fn().mockRejectedValue(new Error("offline")));
      expect(() => useFeedbackSender().send(input)).not.toThrow();
      await new Promise((r) => setTimeout(r, 10));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("is a no-op, not a throw, when Nuxt context is unavailable", () => {
    vi.stubGlobal("useNuxtApp", () => {
      throw new Error("no nuxt context");
    });
    vi.stubGlobal("useRuntimeConfig", () => ({ public: {} }));
    let sender!: ReturnType<typeof useFeedbackSender>;
    expect(() => (sender = useFeedbackSender())).not.toThrow();
    expect(() => sender.send(input)).not.toThrow();
  });

  it("resolves context once, at call time rather than per send", () => {
    const fetch = vi.fn().mockResolvedValue({});
    const useNuxtApp = vi.fn(() => ({ $activityFetch: fetch }));
    vi.stubGlobal("useNuxtApp", useNuxtApp);
    vi.stubGlobal("useRuntimeConfig", () => ({ public: { appVersion: "1.0.0" } }));

    const { send } = useFeedbackSender();
    send(input);
    send(input);

    expect(useNuxtApp).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

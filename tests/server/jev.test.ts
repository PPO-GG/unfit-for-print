// @vitest-environment node
// Node, not jsdom: the client passes an AbortSignal to fetch, and jsdom's
// AbortSignal is not the one Node's fetch accepts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JevError, jevChoose, jevConfigured } from "~/server/utils/jev";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.stubEnv("TYPESAFE_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("jevConfigured", () => {
  it("is true with a key and false without", () => {
    expect(jevConfigured()).toBe(true);
    vi.stubEnv("TYPESAFE_API_KEY", "");
    expect(jevConfigured()).toBe(false);
  });
});

describe("jevChoose", () => {
  it("posts a choice question and returns its probabilities", async () => {
    const fetchMock = vi.fn(async () =>
      ok({
        model: "jev-1.13.0",
        answers: {
          pick: {
            type: "choice",
            choice: "c1",
            confidence: 0.4,
            probabilities: { c0: 0.3, c1: 0.7 },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const probs = await jevChoose("Prompt card: _", "Which?", {
      c0: "[a]",
      c1: "[b]",
    });

    expect(probs).toEqual({ c0: 0.3, c1: 0.7 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      state: "Prompt card: _",
      model: "jev-latest",
      questions: {
        pick: {
          type: "choice",
          instructions: "Which?",
          criteria: { c0: "[a]", c1: "[b]" },
        },
      },
    });
  });

  it("throws without calling fetch when no key is set", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(jevChoose("s", "i", { a: "a" })).rejects.toBeInstanceOf(JevError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws with the status on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));

    await expect(jevChoose("s", "i", { a: "a" })).rejects.toMatchObject({
      message: "HTTP 503",
      status: 503,
    });
  });

  it("throws on a body without probabilities", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ answers: {} })));

    await expect(jevChoose("s", "i", { a: "a" })).rejects.toMatchObject({
      message: "malformed response",
    });
  });

  it("aborts and reports a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener("abort", () =>
              reject(init.signal!.reason),
            );
          }),
      ),
    );

    await expect(
      jevChoose("s", "i", { a: "a" }, { timeoutMs: 10 }),
    ).rejects.toMatchObject({ message: "timeout" });
  });

  it("reports other fetch failures as network errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));

    await expect(jevChoose("s", "i", { a: "a" })).rejects.toMatchObject({
      message: "network",
    });
  });
});

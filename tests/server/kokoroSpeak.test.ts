// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits } from "~~/server/utils/rateLimit";

let currentUserId: string | null = "user-1";
vi.mock("~~/server/utils/session", () => ({
  requireAuth: async () => {
    if (!currentUserId) {
      const err = new Error("Authentication required");
      (err as any).statusCode = 401;
      throw err;
    }
    return currentUserId;
  },
}));

const responseHeaders: Record<string, unknown> = {};
const upstream = vi.fn();

const VALID = { text: "Hello", voice: "af_bella" };

async function call(body: unknown = VALID) {
  vi.stubGlobal("readBody", async () => body);
  const handler = (await import("~~/server/api/kokoro-speak.post")).default;
  return handler({} as any);
}

function audioResponse() {
  return new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  });
}

beforeEach(() => {
  currentUserId = "user-1";
  __resetRateLimits();
  for (const k of Object.keys(responseHeaders)) delete responseHeaders[k];
  upstream.mockReset();
  upstream.mockImplementation(async () => audioResponse());
  vi.stubGlobal("fetch", upstream);
  vi.stubGlobal("setResponseHeader", (_e: unknown, name: string, value: unknown) => {
    responseHeaders[name] = value;
  });
  vi.stubEnv("NUXT_KOKORO_URL", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("POST /api/kokoro-speak", () => {
  it("refuses a caller with no session with 401 and never calls Kokoro", async () => {
    currentUserId = null;
    await expect(call()).rejects.toMatchObject({ statusCode: 401 });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("returns the audio for a signed-in caller and calls Kokoro once", async () => {
    const result = await call();
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(responseHeaders["Content-Type"]).toBe("audio/mpeg");
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("calls Kokoro at NUXT_KOKORO_URL, trimming a trailing slash", async () => {
    vi.stubEnv("NUXT_KOKORO_URL", "http://10.0.0.5:8880/");
    await call();
    expect(upstream.mock.calls[0]![0]).toBe("http://10.0.0.5:8880/v1/audio/speech");
  });

  it("calls the public Kokoro URL when NUXT_KOKORO_URL is unset", async () => {
    await call();
    expect(upstream.mock.calls[0]![0]).toBe("https://kokoro.ppo.gg/v1/audio/speech");
  });

  it("refuses the 21st call from one user inside a minute with 429 and Retry-After", async () => {
    for (let i = 0; i < 20; i++) await call();
    await expect(call()).rejects.toMatchObject({ statusCode: 429 });
    expect(Number(responseHeaders["Retry-After"])).toBeGreaterThan(0);

    currentUserId = "user-2";
    await expect(call()).resolves.toBeDefined();
  });

  it("refuses the 301st call overall inside a minute with 429", async () => {
    for (let i = 0; i < 300; i++) {
      currentUserId = `user-${i % 30}`;
      await call();
    }
    currentUserId = "user-new";
    await expect(call()).rejects.toMatchObject({ statusCode: 429 });
  });

  it("never reaches Kokoro on a rate-limited call", async () => {
    for (let i = 0; i < 20; i++) await call();
    upstream.mockClear();
    await expect(call()).rejects.toMatchObject({ statusCode: 429 });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("maps a Kokoro error page to 502 without echoing its HTML", async () => {
    upstream.mockImplementation(
      async () => new Response("<!DOCTYPE html><html>bad gateway</html>", { status: 520 }),
    );
    const err = await call().catch((e) => e);
    expect(err).toMatchObject({ statusCode: 502 });
    expect(err.message).toBe("TTS upstream error (520)");
    expect(err.message).not.toContain("<");
  });

  it("maps a dropped connection to 502 TTS upstream unreachable", async () => {
    upstream.mockRejectedValue(new TypeError("terminated"));
    const err = await call().catch((e) => e);
    expect(err).toMatchObject({ statusCode: 502 });
    expect(err.message).toBe("TTS upstream unreachable");
  });

  it("gives up on Kokoro with a 30 s timeout signal", async () => {
    await call();
    const init = upstream.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [{ voice: "af_bella" }, "missing text"],
    [{ text: "x".repeat(1001), voice: "af_bella" }, "text too long"],
    [{ text: "Hello", voice: "not-a-voice" }, "invalid voice"],
  ])("still refuses a bad body with 400 (%s: %s)", async (body) => {
    await expect(call(body)).rejects.toMatchObject({ statusCode: 400 });
    expect(upstream).not.toHaveBeenCalled();
  });
});

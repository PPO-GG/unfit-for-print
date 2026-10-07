import { describe, expect, it, vi } from "vitest";
import { createReporter } from "../src/reporter";

describe("createReporter", () => {
  it("posts a server-error report tagged teleportal", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    await createReporter(fetchFn as unknown as typeof fetch, "http://web.test")(
      new Error("boom"),
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://web.test/api/issues/report");
    expect(JSON.parse(init.body as string)).toMatchObject({
      kind: "server-error",
      message: "boom",
      platform: "teleportal",
    });
  });

  it("never rejects when the network call fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(
      createReporter(fetchFn as unknown as typeof fetch, "http://web.test")("x"),
    ).resolves.toBeUndefined();
  });

  it("never throws when fetch itself throws synchronously", async () => {
    const fetchFn = vi.fn(() => {
      throw new Error("sync");
    });
    await expect(
      createReporter(fetchFn as unknown as typeof fetch, "http://web.test")("x"),
    ).resolves.toBeUndefined();
  });
});

import { describe, it, expect, vi } from "vitest";
import { createTtlCache } from "../../teleportal-server/src/ttlCache";

describe("createTtlCache", () => {
  it("computes on first read", () => {
    const compute = vi.fn(() => "summary");
    const cache = createTtlCache(3000, compute, () => 0);

    expect(cache.get()).toBe("summary");
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("serves the cached value within the TTL", () => {
    let t = 0;
    let n = 0;
    const cache = createTtlCache(3000, () => ++n, () => t);

    cache.get();
    t = 2999;

    expect(cache.get()).toBe(1);
  });

  it("recomputes once the TTL has passed", () => {
    let t = 0;
    let n = 0;
    const cache = createTtlCache(3000, () => ++n, () => t);

    cache.get();
    t = 3000;

    expect(cache.get()).toBe(2);
  });

  it("recomputes on the next read after invalidate", () => {
    let n = 0;
    const cache = createTtlCache(3000, () => ++n, () => 0);

    cache.get();
    cache.invalidate();

    expect(cache.get()).toBe(2);
  });

  it("does not cache a compute that threw", () => {
    let fail = true;
    const cache = createTtlCache(
      3000,
      () => {
        if (fail) throw new Error("boom");
        return "ok";
      },
      () => 0,
    );

    expect(() => cache.get()).toThrow("boom");
    fail = false;

    expect(cache.get()).toBe("ok");
  });
});

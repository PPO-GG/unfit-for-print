import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISMISSED_SUPPRESS_MS,
  RATED_SUPPRESS_MS,
  incrementGamesCompleted,
  isPromptSuppressed,
  markDismissed,
  markRated,
  readGamesCompleted,
} from "~/utils/feedbackCadence";
import { makeClientRef } from "~/utils/clientRef";

const T = 1_800_000_000_000;

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("feedback cadence", () => {
  it("is not suppressed on a fresh device", () => {
    expect(isPromptSuppressed(T)).toBe(false);
  });

  it("suppresses for 30 days after a rating", () => {
    markRated(T);
    expect(isPromptSuppressed(T + RATED_SUPPRESS_MS - 1)).toBe(true);
    expect(isPromptSuppressed(T + RATED_SUPPRESS_MS)).toBe(false);
  });

  it("suppresses for 7 days after a dismissal", () => {
    markDismissed(T);
    expect(isPromptSuppressed(T + DISMISSED_SUPPRESS_MS - 1)).toBe(true);
    expect(isPromptSuppressed(T + DISMISSED_SUPPRESS_MS)).toBe(false);
  });

  // Review focus: a clock moved backwards must not suppress forever.
  it("ignores a timestamp from the future", () => {
    markRated(T + 365 * 24 * 60 * 60 * 1000);
    expect(isPromptSuppressed(T)).toBe(false);
  });

  it("ignores garbage in storage", () => {
    localStorage.setItem("feedback-rated-at", "banana");
    expect(isPromptSuppressed(T)).toBe(false);
  });

  it("counts completed games", () => {
    expect(readGamesCompleted()).toBeNull();
    incrementGamesCompleted();
    incrementGamesCompleted();
    expect(readGamesCompleted()).toBe(2);
  });

  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => markRated(T)).not.toThrow();
    expect(isPromptSuppressed(T)).toBe(false);
    expect(() => incrementGamesCompleted()).not.toThrow();
    expect(readGamesCompleted()).toBeNull();
  });
});

describe("makeClientRef", () => {
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("returns a v4 uuid", () => {
    expect(makeClientRef()).toMatch(V4);
  });

  // Review focus: http://192.168.x.x has no crypto.randomUUID.
  it("falls back when randomUUID is unavailable (insecure context)", () => {
    // Shadow the prototype method on the instance; defineProperty works
    // even where plain assignment to the method would be ignored.
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const a = makeClientRef();
      const b = makeClientRef();
      expect(a).toMatch(V4);
      expect(a).not.toBe(b);
    } finally {
      delete (crypto as any).randomUUID;
    }
  });
});

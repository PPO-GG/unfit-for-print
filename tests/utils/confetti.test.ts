import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above plain consts, so the fakes have to be too.
const { cannon, create } = vi.hoisted(() => {
  const cannon = Object.assign(vi.fn(), { reset: vi.fn() });
  return { cannon, create: vi.fn(() => cannon) };
});

vi.mock("canvas-confetti", () => ({ default: { create } }));

describe("confetti cannon", () => {
  beforeEach(() => {
    vi.resetModules();
    create.mockClear();
    cannon.mockClear();
    cannon.reset.mockClear();
  });

  it("animates on the main thread, never the library's worker", async () => {
    const { burstConfetti } = await import("~/utils/confetti");
    burstConfetti({ particleCount: 10 });

    expect(create).toHaveBeenCalledWith(undefined, {
      resize: true,
      useWorker: false,
    });
    expect(cannon).toHaveBeenCalledWith({ particleCount: 10 });
  });

  it("shares one cannon across every burst", async () => {
    const { burstConfetti } = await import("~/utils/confetti");
    burstConfetti({ particleCount: 1 });
    burstConfetti({ particleCount: 2 });

    expect(create).toHaveBeenCalledTimes(1);
    expect(cannon).toHaveBeenCalledTimes(2);
  });

  it("does not build a cannon just to reset one", async () => {
    const { resetConfetti } = await import("~/utils/confetti");
    resetConfetti();

    expect(create).not.toHaveBeenCalled();
  });

  it("resets the live cannon", async () => {
    const { burstConfetti, resetConfetti } = await import("~/utils/confetti");
    burstConfetti({});
    resetConfetti();

    expect(cannon.reset).toHaveBeenCalledTimes(1);
  });
});

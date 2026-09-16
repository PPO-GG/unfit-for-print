import { describe, it, expect, vi } from "vitest";
import { throttleAsync } from "~/server/utils/throttleAsync";

/** A job whose runs stay pending until the test resolves them. */
function deferredJob() {
  const resolvers: Array<(value: number) => void> = [];
  const job = vi.fn(
    () => new Promise<number>((resolve) => resolvers.push(resolve)),
  );
  return { job, finish: (value: number) => resolvers.shift()!(value) };
}

describe("throttleAsync", () => {
  it("runs the job on the first call", async () => {
    const job = vi.fn(async () => 7);
    const run = throttleAsync(job, 1000, 0, () => 0);

    await expect(run()).resolves.toBe(7);
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("shares the run in progress instead of starting a second one", async () => {
    const { job, finish } = deferredJob();
    const run = throttleAsync(job, 1000, 0, () => 0);

    const first = run();
    const second = run();
    finish(3);

    await expect(first).resolves.toBe(3);
    await expect(second).resolves.toBe(3);
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("skips the job within the interval after a run finishes", async () => {
    let t = 0;
    const job = vi.fn(async () => 7);
    const run = throttleAsync(job, 1000, 0, () => t);

    await run();
    t = 999;

    await expect(run()).resolves.toBe(0);
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("runs again once the interval has passed", async () => {
    let t = 0;
    const job = vi.fn(async () => 7);
    const run = throttleAsync(job, 1000, 0, () => t);

    await run();
    t = 1000;
    await run();

    expect(job).toHaveBeenCalledTimes(2);
  });

  it("measures the interval from when a slow run finishes", async () => {
    let t = 0;
    const { job, finish } = deferredJob();
    const run = throttleAsync(job, 1000, 0, () => t);

    const pending = run();
    t = 5000; // the run took longer than the interval
    finish(1);
    await pending;
    t = 5500;

    await expect(run()).resolves.toBe(0);
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("throttles after a failed run too, and passes the failure to its callers", async () => {
    let t = 0;
    const job = vi.fn(async () => {
      throw new Error("boom");
    });
    const run = throttleAsync(job, 1000, 0, () => t);

    await expect(run()).rejects.toThrow("boom");
    t = 10;

    await expect(run()).resolves.toBe(0);
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("runs again straight away after reset", async () => {
    const job = vi.fn(async () => 7);
    const run = throttleAsync(job, 1000, 0, () => 0);

    await run();
    run.reset();
    await run();

    expect(job).toHaveBeenCalledTimes(2);
  });
});

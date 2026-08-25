import { beforeEach, describe, expect, it, vi } from "vitest";

describe("useR2", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NUXT_R2_ACCOUNT_ID = "test-account";
    process.env.NUXT_R2_ACCESS_KEY_ID = "test-key";
    process.env.NUXT_R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.NUXT_R2_BUCKET = "decoration-images";
  });

  it("constructs a client pointed at the R2 account endpoint", async () => {
    const { useR2 } = await import("~/server/utils/r2");

    const client = useR2();

    expect(client.config.endpoint).toBeDefined();
  });

  it("throws when credentials are missing", async () => {
    delete process.env.NUXT_R2_ACCOUNT_ID;
    const { useR2 } = await import("~/server/utils/r2");

    expect(() => useR2()).toThrow();
  });
});

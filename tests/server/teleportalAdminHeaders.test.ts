// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { teleportalAdminHeaders } from "~/server/utils/teleportal";

const g = globalThis as any;

describe("teleportalAdminHeaders", () => {
  afterEach(() => {
    delete g.useRuntimeConfig;
  });

  it("sends the sync admin token as a bearer header", () => {
    g.useRuntimeConfig = () => ({ syncAdminToken: "s3cret", public: {} });
    expect(teleportalAdminHeaders()).toEqual({ Authorization: "Bearer s3cret" });
  });

  it("sends no Authorization header at all when the token is unset", () => {
    g.useRuntimeConfig = () => ({ syncAdminToken: "", public: {} });
    expect(teleportalAdminHeaders()).toEqual({});
    g.useRuntimeConfig = () => ({ public: {} });
    expect(teleportalAdminHeaders()).toEqual({});
  });
});

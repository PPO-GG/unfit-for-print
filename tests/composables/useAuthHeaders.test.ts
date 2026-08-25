import { describe, expect, it } from "vitest";
import {
  getActivityUserId,
  isActivityApiRequest,
  useAuthHeaders,
} from "~/composables/useAuthHeaders";

describe("useAuthHeaders", () => {
  it("returns no headers before a token is set", () => {
    const { authHeaders } = useAuthHeaders();

    expect(authHeaders()).toEqual({});
  });

  it("returns an Authorization header after setActivityToken", () => {
    const { setActivityToken, authHeaders } = useAuthHeaders();
    setActivityToken("abc.def");

    expect(authHeaders()).toEqual({ Authorization: "Bearer abc.def" });
  });

  it("only classifies relative API requests as eligible for Activity auth", () => {
    expect(isActivityApiRequest("/api/decorations/list")).toBe(true);
    expect(isActivityApiRequest("https://discord.com/api/users/@me")).toBe(false);
    expect(isActivityApiRequest("https://unfit.cards/api/decorations/list")).toBe(false);
  });

  it("rejects a relative API path when its base URL is third-party", () => {
    expect(
      isActivityApiRequest(
        "/api/decorations/list",
        "https://discord.com",
        "https://unfit.cards",
      ),
    ).toBe(false);
  });

  it("reads the authenticated user ID from the current Activity token", () => {
    const { setActivityToken } = useAuthHeaders();
    const payload = btoa(JSON.stringify({ userId: "6ac4a08e-0000-4000-8000-000000000001" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    setActivityToken(`${payload}.signature`);

    expect(getActivityUserId()).toBe("6ac4a08e-0000-4000-8000-000000000001");
  });
});

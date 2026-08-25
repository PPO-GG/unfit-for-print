import { describe, expect, it } from "vitest";
import { useAuthHeaders } from "~/composables/useAuthHeaders";

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
});

import { describe, expect, it } from "vitest";
import { requiresJoinUsername } from "~/composables/useUserUtils";
import type { AuthUser } from "~/types/auth";

const accountUser: AuthUser = {
  id: "discord-user",
  discordUserId: "123",
  isGuest: false,
  name: "Discord Name",
  avatarUrl: null,
  activeDecoration: null,
  isAdmin: false,
};

describe("requiresJoinUsername", () => {
  it("requires a name before creating a brand-new anonymous session", () => {
    expect(requiresJoinUsername(null)).toBe(true);
  });

  it("requires a name for an existing guest session", () => {
    expect(requiresJoinUsername({ ...accountUser, isGuest: true })).toBe(true);
  });

  it("uses the account name for authenticated players", () => {
    expect(requiresJoinUsername(accountUser)).toBe(false);
  });
});

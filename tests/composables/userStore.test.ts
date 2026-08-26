import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUserStore } from "~/stores/userStore";

const mockFetch = vi.fn();
vi.stubGlobal("$fetch", mockFetch);

beforeEach(() => {
  setActivePinia(createPinia());
  mockFetch.mockReset();
});

describe("userStore", () => {
  it("fetchSession populates user from /api/auth/session", async () => {
    mockFetch.mockResolvedValueOnce({
      user: { id: "u1", name: "Alice", isGuest: false, isAdmin: false, discordUserId: "d1", avatarUrl: null, activeDecoration: null },
    });

    const store = useUserStore();
    await store.fetchSession();

    expect(store.isLoggedIn).toBe(true);
    expect(store.user?.name).toBe("Alice");
  });

  it("fetchSession leaves isLoggedIn false when there's no session", async () => {
    mockFetch.mockResolvedValueOnce({ user: null });
    const store = useUserStore();
    await store.fetchSession();
    expect(store.isLoggedIn).toBe(false);
    expect(store.user).toBeNull();
  });

  it("logout clears user state", async () => {
    mockFetch.mockResolvedValueOnce({ success: true });
    const store = useUserStore();
    store.user = { id: "u1" } as any;
    store.isLoggedIn = true;

    await store.logout();
    expect(store.user).toBeNull();
    expect(store.isLoggedIn).toBe(false);
  });
});

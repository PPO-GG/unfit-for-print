import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUserStore } from "~/stores/userStore";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  getLobbyByCode: vi.fn(async () => ({ id: "lobby-1", code: "ABCD" })),
  isInLobby: vi.fn(async () => false),
  joinLobby: vi.fn(async () => ({ player: { id: "p1" } })),
}));

vi.mock("vue-router", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("~/composables/useLobby", () => ({
  useLobby: () => ({
    getLobbyByCode: h.getLobbyByCode,
    isInLobby: h.isInLobby,
    joinLobby: h.joinLobby,
    getActiveLobbyForUser: vi.fn(),
  }),
}));
vi.mock("~/composables/useProfanityFilter", () => ({
  useProfanityFilter: () => ({ isBadUsername: () => false }),
}));

import { useJoinLobby } from "~/composables/useJoinLobby";

// Leaving a lobby — or the host closing it — deletes a guest's account, but a
// tab that never reloads still holds that guest in memory. Its next join was
// refused (401) by a server that no longer knew it.
describe("useJoinLobby with a guest session held in memory", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
  });

  it("re-establishes the guest under the typed name before joining", async () => {
    const store = useUserStore();
    store.user = { id: "gone-guest", isGuest: true, name: "Dev" } as any;
    store.isLoggedIn = true;
    const order: string[] = [];
    const login = vi.spyOn(store, "loginAsGuest").mockImplementation(async () => {
      order.push("login");
      store.user = { id: "fresh-guest", isGuest: true, name: "Dev" } as any;
    });
    h.joinLobby.mockImplementation(async () => {
      order.push("join");
      return { player: { id: "p1" } };
    });

    const ok = await useJoinLobby().joinLobbyWithSession("Dev", "abcd");

    expect(ok).toBe(true);
    expect(login).toHaveBeenCalledWith("Dev");
    expect(order).toEqual(["login", "join"]);
    expect(h.isInLobby).toHaveBeenCalledWith("fresh-guest", "lobby-1");
  });

  it("leaves a signed-in account alone", async () => {
    const store = useUserStore();
    store.user = { id: "discord-user", isGuest: false, name: "mynd" } as any;
    store.isLoggedIn = true;
    const login = vi.spyOn(store, "loginAsGuest");

    await useJoinLobby().joinLobbyWithSession("mynd", "abcd");

    expect(login).not.toHaveBeenCalled();
    expect(h.joinLobby).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const joinLobbyWithSession = vi.fn(async () => true);
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("~/composables/useJoinLobby", () => ({
  useJoinLobby: () => ({
    joinLobbyWithSession,
    initSessionIfNeeded: vi.fn(async () => {}),
  }),
}));
vi.mock("~/composables/useUserUtils", () => ({
  requiresJoinUsername: () => false,
}));
vi.mock("~/stores/userStore", () => ({
  useUserStore: () => ({ user: { id: "u1", name: "Mynd" } }),
}));
(globalThis as any).$fetch = vi.fn(async () => ({ hasPassword: false }));

import JoinTakeover from "~/components/lobby/JoinTakeover.vue";

const mk = async () => {
  const w = mount(JoinTakeover, {
    props: { open: false },
    global: { stubs: { teleport: true, UIcon: true } },
  });
  await w.setProps({ open: true });
  await flushPromises();
  return w;
};

describe("JoinTakeover — code entry on phones", () => {
  beforeEach(() => joinLobbyWithSession.mockClear());

  it("has a real text input so a phone opens its keyboard", async () => {
    const w = await mk();
    const input = w.get("input.join-code-input");
    expect(input.attributes("inputmode")).toBe("text");
    expect(input.attributes("autocapitalize")).toBe("characters");
    expect(input.attributes("enterkeyhint")).toBe("go");
  });

  it("fills the slots from typed text, uppercased, without separators", async () => {
    const w = await mk();
    const input = w.get("input.join-code-input");
    await input.setValue("fs-pj");
    expect(w.findAll(".join-slot").map((s) => s.classes("filled"))).toEqual([
      true, true, true, true,
    ]);
    expect((input.element as HTMLInputElement).value).toBe("FSPJ");
  });

  it("keeps only four characters", async () => {
    const w = await mk();
    const input = w.get("input.join-code-input");
    await input.setValue("abcdef");
    expect((input.element as HTMLInputElement).value).toBe("ABCD");
  });

  it("joins on the keyboard's Go/Enter key", async () => {
    const w = await mk();
    const input = w.get("input.join-code-input");
    await input.setValue("fspj");
    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(joinLobbyWithSession).toHaveBeenCalledTimes(1);
    expect(joinLobbyWithSession.mock.calls[0]![1]).toBe("FSPJ");
  });

  it("deleting in the input clears slots", async () => {
    const w = await mk();
    const input = w.get("input.join-code-input");
    await input.setValue("fsp");
    await input.setValue("fs");
    expect(w.findAll(".join-slot").map((s) => s.classes("filled"))).toEqual([
      true, true, false, false,
    ]);
  });
});

// The /game/[code] page opens the card for a visitor who followed an invite
// link: the code is already known, so they only add a name.
describe("JoinTakeover — opened from an invite link", () => {
  beforeEach(() => joinLobbyWithSession.mockClear());

  const mkWithCode = async (initialCode: string) => {
    const w = mount(JoinTakeover, {
      props: { open: false, initialCode },
      global: { stubs: { teleport: true, UIcon: true } },
    });
    await w.setProps({ open: true });
    await flushPromises();
    return w;
  };

  it("fills the code slots from the link", async () => {
    const w = await mkWithCode("fspj");
    expect(w.findAll(".join-slot").map((s) => s.text())).toEqual([
      expect.stringContaining("F"),
      expect.stringContaining("S"),
      expect.stringContaining("P"),
      expect.stringContaining("J"),
    ]);
    expect((w.get("input.join-code-input").element as HTMLInputElement).value).toBe("FSPJ");
  });

  it("joins that code without retyping it", async () => {
    const w = await mkWithCode("FSPJ");
    await w.get(".join-submit").trigger("click");
    await flushPromises();
    expect(joinLobbyWithSession).toHaveBeenCalledTimes(1);
    expect(joinLobbyWithSession.mock.calls[0]![1]).toBe("FSPJ");
  });

  it("ignores anything in the link that is not a code character", async () => {
    const w = await mkWithCode("fs-pj!x");
    expect((w.get("input.join-code-input").element as HTMLInputElement).value).toBe("FSPJ");
  });
});

describe("JoinTakeover — mounted already open", () => {
  it("fills the code from the link without an open transition", async () => {
    const w = mount(JoinTakeover, {
      props: { open: true, initialCode: "GKYG" },
      global: { stubs: { teleport: true, UIcon: true } },
    });
    await flushPromises();
    expect((w.get("input.join-code-input").element as HTMLInputElement).value).toBe("GKYG");
  });
});

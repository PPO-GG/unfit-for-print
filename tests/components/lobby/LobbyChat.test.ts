import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
(globalThis as any).useUserStore = () => ({ user: { id: "u1" } });
vi.unmock("vue");
vi.mock("~/composables/useLobby", () => ({ useLobby: () => ({ lobbyDoc: {} }) }));
vi.mock("~/composables/useLobbyChat", () => ({ useLobbyChat: () => ({ sendMessage: vi.fn() }) }));
vi.mock("~/composables/useSfx", () => ({ useSfx: () => ({ playSfx: vi.fn() }) }));

import LobbyChat from "~/components/lobby/LobbyChat.vue";

const messages = Array.from({ length: 30 }, (_, i) => ({
  id: `m${i}`, userId: "u2", name: "Sam", text: `message ${i}`, timestamp: i,
})) as any;

// jsdom has no layout, so give the list a scroll height to land on.
function withScrollHeight(el: HTMLElement, height: number) {
  Object.defineProperty(el, "scrollHeight", { value: height, configurable: true });
}

describe("LobbyChat scrolling", () => {
  it("opens at the newest message", async () => {
    const proto = HTMLElement.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, "scrollHeight");
    Object.defineProperty(proto, "scrollHeight", { get: () => 900, configurable: true });
    try {
      const w = mount(LobbyChat, { props: { messages } });
      await Vue.nextTick();
      expect((w.get(".lobby-chat-messages").element as HTMLElement).scrollTop).toBe(900);
    } finally {
      if (original) Object.defineProperty(proto, "scrollHeight", original);
      else delete (proto as any).scrollHeight;
    }
  });

  it("exposes scrollToBottom for a parent that un-hides it", async () => {
    const w = mount(LobbyChat, { props: { messages } });
    const list = w.get(".lobby-chat-messages").element as HTMLElement;
    withScrollHeight(list, 1200);
    list.scrollTop = 0;
    (w.vm as any).scrollToBottom();
    expect(list.scrollTop).toBe(1200);
  });
});

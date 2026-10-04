import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import * as Vue from "vue";

Object.assign(globalThis, Vue);
(globalThis as any).useI18n = () => ({ t: (key: string) => key });
import { vi } from "vitest";
vi.unmock("vue");

import CompactChatSheet from "~/components/game/compact/CompactChatSheet.vue";

const stubs = {
  UDrawer: {
    props: ["open", "title"],
    template: '<div v-if="open" class="drawer" :data-title="title"><slot name="body" /></div>',
  },
  LobbyChat: { props: ["messages"], template: '<div class="lobby-chat-stub">{{ messages.length }}</div>' },
};
const messages = [
  { id: "m1", userId: "u1", name: "Sam", text: "hi", timestamp: 1 },
  { id: "m2", userId: "u2", name: "Ed", text: "yo", timestamp: 2 },
] as any;

describe("CompactChatSheet", () => {
  it("shows only the chat, in its own sheet", () => {
    const w = mount(CompactChatSheet, { props: { open: true, messages }, global: { stubs } });
    expect(w.get(".drawer").attributes("data-title")).toBe("compact.chat");
    expect(w.get(".lobby-chat-stub").text()).toBe("2");
  });

  it("renders nothing while closed", () => {
    const w = mount(CompactChatSheet, { props: { open: false, messages }, global: { stubs } });
    expect(w.find(".lobby-chat-stub").exists()).toBe(false);
  });
});

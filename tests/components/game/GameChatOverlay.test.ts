import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import GameChatOverlay from "~/components/game/GameChatOverlay.vue";
import type { ChatMessage } from "~/composables/useLobbyReactive";
import { selectIdleChatToasts } from "~/composables/useIdleChatToasts";

const chat = ref<ChatMessage[]>([]);
let activeWrapper: ReturnType<typeof mount> | null = null;

function message(id: string): ChatMessage {
  return {
    id,
    userId: "alice",
    name: "Alice",
    text: "Hello",
    timestamp: 1_000,
    isSystem: false,
  };
}

function mountOverlay() {
  vi.stubGlobal("useI18n", () => ({ t: (_key: string, fallback: string) => fallback }));
  vi.stubGlobal("useUserPrefsStore", () => ({ chatProfanityFilter: false }));
  vi.stubGlobal("useSfx", () => ({ playSfx: vi.fn() }));
  vi.stubGlobal("useSanitize", () => ({ sanitize: (text: string) => text }));
  vi.stubGlobal("useLobby", () => ({ reactive: { chat }, lobbyDoc: {} }));
  vi.stubGlobal("useLobbyChat", () => ({ sendMessage: vi.fn() }));
  vi.stubGlobal("useUserStore", () => ({ user: { id: "me" } }));
  vi.stubGlobal("selectIdleChatToasts", selectIdleChatToasts);

  return mount(GameChatOverlay, {
    global: {
      plugins: [createPinia()],
      stubs: { Transition: false, TransitionGroup: false, UIcon: true },
    },
  });
}

describe("GameChatOverlay", () => {
  afterEach(() => {
    activeWrapper?.unmount();
    activeWrapper = null;
    chat.value = [];
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fades out a closed-chat toast and removes it at its 12-second expiry", async () => {
    vi.useFakeTimers();
    const wrapper = mountOverlay();
    activeWrapper = wrapper;

    chat.value = [message("arrival")];
    await nextTick();
    expect(wrapper.findAll(".chat-idle-row")).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(11_400);
    await nextTick();

    const toast = wrapper.find(".chat-idle-row");
    expect(toast.exists()).toBe(true);
    expect(toast.classes()).toContain("chat-fade-leave-active");

    await vi.advanceTimersByTimeAsync(600);
    await nextTick();
    expect(wrapper.findAll(".chat-idle-row")).toHaveLength(0);
  });
});

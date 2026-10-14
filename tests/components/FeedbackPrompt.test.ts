import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";

const send = vi.fn();
const openModal = vi.fn();
const route = reactive({ path: "/game/AB2C" });

vi.mock("~/composables/useFeedbackSender", () => ({
  useFeedbackSender: () => ({ send }),
}));
vi.mock("~/composables/useFeedbackModal", () => ({
  useFeedbackModal: () => ({ open: openModal }),
}));
vi.mock("~/composables/useCompactLayout", async () => {
  const { ref } = await import("vue");
  return { useCompactLayout: () => ({ isCompact: ref(false) }) };
});
vi.stubGlobal("useRoute", () => route);
// @ts-ignore — provided by @nuxtjs/i18n's auto-import at runtime
globalThis.useI18n = () => ({ t: (k: string) => k });

import FeedbackPrompt from "~/components/FeedbackPrompt.vue";
import { useFeedbackPrompt, __resetFeedbackPrompt } from "~/composables/useFeedbackPrompt";

const game = { lobbyCode: "AB2C", gameEndTime: 1000, isSpectator: false };
// test-utils' default Transition stub renders/removes children synchronously;
// a real Transition in jsdom would leave the leaving element in the DOM.
const mountPrompt = () => mount(FeedbackPrompt);

beforeEach(() => {
  localStorage.clear();
  send.mockClear();
  openModal.mockClear();
  route.path = "/game/AB2C";
  __resetFeedbackPrompt();
});

describe("FeedbackPrompt", () => {
  it("renders nothing until a game is offered", () => {
    expect(mountPrompt().find('[data-testid="feedback-prompt"]').exists()).toBe(false);
  });

  it("asks, then thanks after a star tap", async () => {
    const w = mountPrompt();
    useFeedbackPrompt().offer(game);
    await nextTick();
    expect(w.text()).toContain("feedback.prompt_question");
    await w.get('[data-testid="star-5"]').trigger("click");
    expect(send).toHaveBeenCalledTimes(1);
    expect(w.text()).toContain("feedback.prompt_thanks");
  });

  it("is non-modal and announces politely without stealing focus", async () => {
    const w = mountPrompt();
    useFeedbackPrompt().offer(game);
    await nextTick();
    const card = w.get('[data-testid="feedback-prompt"]');
    expect(card.attributes("aria-modal")).toBeUndefined();
    expect(card.attributes("role")).toBeUndefined();
  });

  it("announces through a live region that exists before the card appears", async () => {
    const w = mountPrompt();
    const live = w.get('[data-testid="feedback-prompt-live"]');
    expect(live.attributes("aria-live")).toBe("polite");
    expect(live.text()).toBe("");
    useFeedbackPrompt().offer(game);
    await nextTick();
    expect(w.get('[data-testid="feedback-prompt-live"]').element).toBe(live.element);
    expect(live.text()).toBe("feedback.prompt_question");
  });

  it("does not send a rating when a keyboard player arrows across the stars", async () => {
    const w = mount(FeedbackPrompt, { attachTo: document.body });
    useFeedbackPrompt().offer(game);
    await nextTick();
    const star1 = w.get('[data-testid="star-1"]');
    (star1.element as HTMLElement).focus();
    await star1.trigger("keydown", { key: "ArrowRight" });
    await w.get('[data-testid="star-2"]').trigger("keydown", { key: "ArrowRight" });
    expect(send).not.toHaveBeenCalled();
    expect(useFeedbackPrompt().stage.value).toBe("ask");
    expect(localStorage.getItem("feedback-rated-at")).toBeNull();
    w.unmount();
  });

  it("moves focus to Tell us more after a rating", async () => {
    const w = mount(FeedbackPrompt, { attachTo: document.body });
    useFeedbackPrompt().offer(game);
    await nextTick();
    await w.get('[data-testid="star-4"]').trigger("click");
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(w.get('[data-testid="feedback-prompt-more"]').element);
    w.unmount();
  });

  it("closes on ✕ and records the dismissal", async () => {
    const w = mountPrompt();
    useFeedbackPrompt().offer(game);
    await nextTick();
    await w.get('[data-testid="feedback-prompt-close"]').trigger("click");
    expect(w.find('[data-testid="feedback-prompt"]').exists()).toBe(false);
    expect(localStorage.getItem("feedback-dismissed-at")).not.toBeNull();
  });

  it("opens the modal on Tell us more", async () => {
    const w = mountPrompt();
    useFeedbackPrompt().offer(game);
    await nextTick();
    await w.get('[data-testid="star-3"]').trigger("click");
    await w.get('[data-testid="feedback-prompt-more"]').trigger("click");
    expect(openModal).toHaveBeenCalledWith(expect.objectContaining({ rating: 3, mode: "idea" }));
    expect(w.find('[data-testid="feedback-prompt"]').exists()).toBe(false);
  });

  it("survives the podium → lobby return (same route) but hides on leaving the game", async () => {
    const w = mountPrompt();
    useFeedbackPrompt().offer(game);
    await nextTick();
    route.path = "/game/AB2C"; // auto-return keeps the route
    await nextTick();
    expect(w.find('[data-testid="feedback-prompt"]').exists()).toBe(true);
    route.path = "/";
    await nextTick();
    expect(w.find('[data-testid="feedback-prompt"]').exists()).toBe(false);
    expect(localStorage.getItem("feedback-dismissed-at")).toBeNull();
  });
});

// The merged "Send feedback" modal. Broken mode is the old Report-a-Problem
// form, unchanged behind the toggle; idea mode is the new feedback path.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const report = vi.fn();
const send = vi.fn();
const notify = vi.fn();
const close = vi.fn();
const isOpen = ref(true);
const options = ref<any>({});

vi.mock("~/composables/useIssueReporter", () => ({
  useIssueReporter: () => ({ report, registerContextProvider: vi.fn() }),
}));
vi.mock("~/composables/useFeedbackSender", () => ({
  useFeedbackSender: () => ({ send }),
}));
vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify }),
}));
vi.mock("~/composables/useFeedbackModal", () => ({
  useFeedbackModal: () => ({ isOpen, options, open: vi.fn(), close }),
}));

// @ts-ignore — provided by @nuxtjs/i18n's auto-import at runtime
globalThis.useI18n = () => ({ t: (_key: string, fallback?: unknown) => (typeof fallback === "string" ? fallback : _key) });

import FeedbackModal from "~/components/FeedbackModal.vue";

const stubs = {
  UModal: { template: `<div><slot name="body" /><slot name="footer" /></div>` },
  UButton: { template: `<button v-bind="$attrs"><slot /></button>` },
  UIcon: { template: `<i />` },
  USelect: {
    props: ["modelValue", "items"],
    emits: ["update:modelValue"],
    template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <option v-for="i in items" :key="i.value" :value="i.value">{{ i.label }}</option>
    </select>`,
  },
  UTextarea: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: `<textarea :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
  },
};

function mountModal(opts: Record<string, unknown> = {}) {
  options.value = {
    mode: "idea",
    rating: null,
    clientRef: null,
    source: "feedback_modal",
    lobbyCode: null,
    ...opts,
  };
  return mount(FeedbackModal, { global: { stubs } });
}

beforeEach(() => {
  report.mockClear();
  send.mockClear();
  notify.mockClear();
  close.mockClear();
});

describe("FeedbackModal — broken mode", () => {
  const broken = () => mountModal({ mode: "broken" });

  it("submits the player's text as a player-report", async () => {
    const w = broken();
    await w.find("textarea").setValue("the judge never got to pick");
    await w.get('[data-testid="report-submit"]').trigger("click");
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0]).toMatchObject({
      kind: "player-report",
      message: "the judge never got to pick",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("attaches the chosen category to the context", async () => {
    const w = broken();
    await w.find("select").setValue("visual");
    await w.find("textarea").setValue("cards overlap on my phone");
    await w.get('[data-testid="report-submit"]').trigger("click");
    expect(report.mock.calls[0][0].context).toMatchObject({ category: "visual" });
  });

  it("caps the message at 500 characters", async () => {
    const w = broken();
    await w.find("textarea").setValue("x".repeat(900));
    await w.get('[data-testid="report-submit"]').trigger("click");
    expect(report.mock.calls[0][0].message).toHaveLength(500);
  });

  it("refuses an empty or whitespace message", async () => {
    const w = broken();
    await w.find("textarea").setValue("      ");
    await w.get('[data-testid="report-submit"]').trigger("click");
    expect(report).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("confirms, clears and closes after a submit", async () => {
    const w = broken();
    await w.find("textarea").setValue("chat is stuck");
    await w.get('[data-testid="report-submit"]').trigger("click");
    expect(notify).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(w.find("textarea").element.value).toBe("");
  });
});

describe("FeedbackModal — idea mode", () => {
  it("opens in the mode it was asked for and can switch", async () => {
    const w = mountModal({ mode: "broken" });
    expect(w.find('[data-testid="report-submit"]').exists()).toBe(true);
    await w.get('[data-testid="mode-idea"]').trigger("click");
    expect(w.find('[data-testid="idea-submit"]').exists()).toBe(true);
    expect(w.find('[data-testid="report-submit"]').exists()).toBe(false);
  });

  it("refuses to send with neither stars nor text", async () => {
    const w = mountModal();
    await w.get('[data-testid="idea-submit"]').trigger("click");
    expect(send).not.toHaveBeenCalled();
  });

  it("sends stars, topics and trimmed text with a fresh clientRef", async () => {
    const w = mountModal();
    await w.get('[data-testid="star-4"]').trigger("click");
    await w.get('[data-testid="topic-cards"]').trigger("click");
    await w.get('[data-testid="topic-bots"]').trigger("click");
    await w.get('[data-testid="topic-bots"]').trigger("click"); // toggled off
    await w.find("textarea").setValue("  more packs  ");
    await w.get('[data-testid="idea-submit"]').trigger("click");

    expect(send).toHaveBeenCalledTimes(1);
    const sent = send.mock.calls[0][0];
    expect(sent).toMatchObject({
      rating: 4,
      topics: ["cards"],
      message: "more packs",
      source: "feedback_modal",
    });
    expect(sent.clientRef).toMatch(/^[0-9a-f-]{36}$/);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("sends text alone with a null rating", async () => {
    const w = mountModal();
    await w.find("textarea").setValue("love the bots");
    await w.get('[data-testid="idea-submit"]').trigger("click");
    expect(send.mock.calls[0][0]).toMatchObject({ rating: null, message: "love the bots" });
  });

  it("carries the prompt's rating, clientRef and source through", async () => {
    const ref = "3f2b8c1e-9d4a-4f6b-8a2e-1c5d7e9f0a1b";
    const w = mountModal({ rating: 5, clientRef: ref, source: "game_over_prompt", lobbyCode: "AB2C" });
    await w.find("textarea").setValue("so good");
    await w.get('[data-testid="idea-submit"]').trigger("click");
    expect(send.mock.calls[0][0]).toMatchObject({
      clientRef: ref,
      rating: 5,
      source: "game_over_prompt",
      lobbyCode: "AB2C",
    });
  });

  it("caps idea text at 1000 characters", async () => {
    const w = mountModal();
    await w.find("textarea").setValue("y".repeat(1500));
    await w.get('[data-testid="idea-submit"]').trigger("click");
    expect(send.mock.calls[0][0].message).toHaveLength(1000);
  });
});

// The player-facing half of issue tracking. Everything here is about the
// submit path: what reaches useIssueReporter, and what is refused before it
// gets there. The transport itself is covered by the reporter's own tests.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const report = vi.fn();
const notify = vi.fn();
const close = vi.fn();

vi.mock("~/composables/useIssueReporter", () => ({
  useIssueReporter: () => ({ report, registerContextProvider: vi.fn() }),
}));
vi.mock("~/composables/useNotifications", () => ({
  useNotifications: () => ({ notify }),
}));
vi.mock("~/composables/useReportProblem", () => ({
  useReportProblem: () => ({ isOpen: ref(true), open: vi.fn(), close }),
}));

// @ts-ignore — provided by @nuxtjs/i18n's auto-import at runtime
globalThis.useI18n = () => ({ t: (_key: string, fallback?: string) => fallback ?? _key });

import ReportProblemModal from "~/components/ReportProblemModal.vue";

const stubs = {
  UModal: { template: `<div><slot name="body" /><slot name="footer" /></div>` },
  UButton: { template: `<button v-bind="$attrs"><slot /></button>` },
  UIcon: { template: `<i />` },
  USelect: {
    // Renders real options, so setValue() has something to match — a bare
    // <select> silently resolves every setValue to "".
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

function mountModal() {
  return mount(ReportProblemModal, { global: { stubs } });
}

async function fill(wrapper: ReturnType<typeof mountModal>, text: string) {
  await wrapper.find("textarea").setValue(text);
}

function submitButton(wrapper: ReturnType<typeof mountModal>) {
  return wrapper.get('[data-testid="report-submit"]');
}

beforeEach(() => {
  report.mockClear();
  notify.mockClear();
  close.mockClear();
});

describe("ReportProblemModal", () => {
  it("submits the player's text as a player-report", async () => {
    const wrapper = mountModal();
    await fill(wrapper, "the judge never got to pick");
    await submitButton(wrapper).trigger("click");

    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0]).toMatchObject({
      kind: "player-report",
      message: "the judge never got to pick",
    });
  });

  it("attaches the chosen category to the context", async () => {
    const wrapper = mountModal();
    await wrapper.find("select").setValue("visual");
    await fill(wrapper, "cards overlap on my phone");
    await submitButton(wrapper).trigger("click");

    expect(report.mock.calls[0][0].context).toMatchObject({ category: "visual" });
  });

  it("trims surrounding whitespace from the message", async () => {
    const wrapper = mountModal();
    await fill(wrapper, "   it froze   ");
    await submitButton(wrapper).trigger("click");

    expect(report.mock.calls[0][0].message).toBe("it froze");
  });

  // The server truncates too, but a client that sends 9KB and gets silently
  // clipped is a worse experience than one that never lets it happen.
  it("caps the message at 500 characters", async () => {
    const wrapper = mountModal();
    await fill(wrapper, "x".repeat(900));
    await submitButton(wrapper).trigger("click");

    expect(report.mock.calls[0][0].message).toHaveLength(500);
  });

  it("refuses to submit an empty message", async () => {
    const wrapper = mountModal();
    await submitButton(wrapper).trigger("click");

    expect(report).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("refuses to submit a message that is only whitespace", async () => {
    const wrapper = mountModal();
    await fill(wrapper, "      ");
    await submitButton(wrapper).trigger("click");

    expect(report).not.toHaveBeenCalled();
  });

  it("confirms and closes after a successful submit", async () => {
    const wrapper = mountModal();
    await fill(wrapper, "chat is stuck");
    await submitButton(wrapper).trigger("click");

    expect(notify).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  // Reopening must not show the previous report still sitting in the box.
  it("clears the field after submitting", async () => {
    const wrapper = mountModal();
    await fill(wrapper, "first report");
    await submitButton(wrapper).trigger("click");

    expect(wrapper.find("textarea").element.value).toBe("");
  });
});

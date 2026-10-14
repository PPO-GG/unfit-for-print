// The shared confirm prompt. Nuxt UI's Modal and Slideover set no z-index,
// so overlays stack by where their portal lands in <body>. A slideover whose
// portal mounts after this one — the admin lobby drawer, inside the page's
// <ClientOnly> — covered the confirm it opened and softlocked the page.

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

// @ts-ignore — auto-imported at runtime
globalThis.useConfirm = () => ({
  isOpen: ref(true),
  options: ref({ title: "Delete?", message: "Sure?" }),
  onConfirm: () => {},
  onCancel: () => {},
});

import ConfirmDialog from "~/components/ConfirmDialog.vue";

const zIndex = (cls: unknown) => Number(/(?:^|\s)z-\[(\d+)\]/.exec(String(cls ?? ""))?.[1] ?? NaN);

describe("ConfirmDialog", () => {
  it("stacks its overlay and content above other overlays regardless of portal order", () => {
    let ui: Record<string, string> | undefined;
    mount(ConfirmDialog, {
      global: {
        stubs: {
          ClientOnly: { template: `<div><slot /></div>` },
          UButton: { template: `<button><slot /></button>` },
          UModal: {
            props: ["ui"],
            setup(props: { ui?: Record<string, string> }) {
              ui = props.ui;
            },
            template: `<div><slot name="body" /><slot name="footer" /></div>`,
          },
        },
      },
    });
    expect(zIndex(ui?.overlay)).toBeGreaterThan(50);
    expect(zIndex(ui?.content)).toBe(zIndex(ui?.overlay));
  });
});

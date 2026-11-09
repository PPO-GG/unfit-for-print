// The shared confirm prompt. Nuxt UI's Modal and Slideover set no z-index,
// so overlays stack by where their portal lands in <body>. A slideover whose
// portal mounts after this one — the admin lobby drawer, inside the page's
// <ClientOnly> — covered the confirm it opened and softlocked the page.

//
// The in-game menu (GameEscMenu) is not a Nuxt UI overlay: it teleports to
// <body> with its own z-index. At an equal z-index it mounts after this
// dialog and wins, so the host's "Remove player?" confirm opened under the
// menu and softlocked the game.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

function mountAndReadUi() {
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
  return ui;
}

const escMenuZIndex = () => {
  const src = readFileSync(resolve(__dirname, "../../app/components/game/GameEscMenu.vue"), "utf8");
  return Number(/\.esc-menu-backdrop\s*\{[^}]*z-index:\s*(\d+)/.exec(src)?.[1] ?? NaN);
};

describe("ConfirmDialog", () => {
  it("stacks above the in-game menu and below popovers", () => {
    const ui = mountAndReadUi();
    expect(escMenuZIndex()).toBeGreaterThan(0);
    expect(zIndex(ui?.overlay)).toBeGreaterThan(escMenuZIndex());
    expect(zIndex(ui?.overlay)).toBeLessThan(250);
  });

  it("stacks its overlay and content above other overlays regardless of portal order", () => {
    const ui = mountAndReadUi();
    expect(zIndex(ui?.overlay)).toBeGreaterThan(50);
    expect(zIndex(ui?.content)).toBe(zIndex(ui?.overlay));
  });
});

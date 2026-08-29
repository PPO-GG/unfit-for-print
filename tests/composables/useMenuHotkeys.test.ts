import { describe, expect, it, vi } from "vitest";
import { createMenuHotkeyHandler } from "~/composables/useMenuHotkeys";

function setup(options: { canCreate?: boolean; isJoinOpen?: boolean } = {}) {
  const actions = {
    create: vi.fn(),
    join: vi.fn(),
    games: vi.fn(),
    labs: vi.fn(),
    howToPlay: vi.fn(),
  };
  const handler = createMenuHotkeyHandler({
    ...actions,
    canCreate: () => options.canCreate ?? true,
    canJoin: () => true,
    isJoinOpen: () => options.isJoinOpen ?? false,
  });

  return { actions, handler };
}

describe("createMenuHotkeyHandler", () => {
  it("runs the action mapped to each menu shortcut", () => {
    const { actions, handler } = setup();

    handler(new KeyboardEvent("keydown", { key: "n" }));
    handler(new KeyboardEvent("keydown", { key: "J" }));
    handler(new KeyboardEvent("keydown", { key: "g" }));
    handler(new KeyboardEvent("keydown", { key: "L" }));
    handler(new KeyboardEvent("keydown", { key: "?" }));

    expect(actions.create).toHaveBeenCalledOnce();
    expect(actions.join).toHaveBeenCalledOnce();
    expect(actions.games).toHaveBeenCalledOnce();
    expect(actions.labs).toHaveBeenCalledOnce();
    expect(actions.howToPlay).toHaveBeenCalledOnce();
  });

  it("does not intercept keys while typing, with a modifier, or in the join overlay", () => {
    const input = document.createElement("input");
    const { actions, handler } = setup();

    handler(new KeyboardEvent("keydown", { key: "j", ctrlKey: true }));
    input.addEventListener("keydown", handler);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));

    const { actions: overlayActions, handler: overlayHandler } = setup({ isJoinOpen: true });
    overlayHandler(new KeyboardEvent("keydown", { key: "j" }));

    expect(actions.join).not.toHaveBeenCalled();
    expect(overlayActions.join).not.toHaveBeenCalled();
  });

  it("does not create a game when the Create tile is unavailable", () => {
    const { actions, handler } = setup({ canCreate: false });

    handler(new KeyboardEvent("keydown", { key: "n" }));

    expect(actions.create).not.toHaveBeenCalled();
  });
});

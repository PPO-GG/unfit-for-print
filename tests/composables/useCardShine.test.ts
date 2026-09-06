// tests/composables/useCardShine.test.ts
//
// WhiteCard and BlackCard each started a self-perpetuating requestAnimationFrame
// loop on mount and never cancelled it, so every card that unmounted left a loop
// running forever — writing to a reactive ref ~60x/sec for the life of the page.
// Browsing a pack (24 cards, re-mounted on every type toggle and page change)
// piled these up and the UI got progressively slower.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useCardShine } from "~/composables/useCardShine";

/** Controllable rAF: frames only advance when the test says so. */
function fakeRaf() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  const cancelled: number[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    cancelled.push(id);
    pending.delete(id);
  });
  return {
    cancelled,
    get pendingCount() {
      return pending.size;
    },
    /** Runs every callback queued right now (each may queue the next frame). */
    advance() {
      const due = [...pending.entries()];
      pending.clear();
      for (const [, cb] of due) cb(performance.now());
    },
  };
}

function mountShine(enabled = true) {
  const rotation = ref({ x: 0, y: 0 });
  let shine: ReturnType<typeof useCardShine>;
  const wrapper = mount(
    defineComponent({
      setup() {
        shine = useCardShine(rotation, () => enabled);
        return () => h("div");
      },
    }),
  );
  return { wrapper, rotation, shine: shine! };
}

let raf: ReturnType<typeof fakeRaf>;
beforeEach(() => {
  vi.unstubAllGlobals();
  raf = fakeRaf();
});

describe("useCardShine", () => {
  it("runs an animation frame loop while the card is mounted", () => {
    mountShine();
    expect(raf.pendingCount).toBe(1);
    raf.advance();
    expect(raf.pendingCount).toBe(1);
  });

  it("cancels its pending frame when the card unmounts", () => {
    const { wrapper } = mountShine();
    expect(raf.pendingCount).toBe(1);

    wrapper.unmount();

    expect(raf.cancelled).toHaveLength(1);
    expect(raf.pendingCount).toBe(0);
  });

  it("stops looping after unmount, so an unmounted card costs nothing", () => {
    const { wrapper } = mountShine();
    wrapper.unmount();

    raf.advance();

    expect(raf.pendingCount).toBe(0);
  });

  it("does not accumulate loops when many cards mount and unmount", () => {
    const cards = Array.from({ length: 24 }, () => mountShine());
    expect(raf.pendingCount).toBe(24);

    cards.forEach((c) => c.wrapper.unmount());

    expect(raf.pendingCount).toBe(0);
  });

  it("never starts a loop when the effect is disabled", () => {
    mountShine(false);
    expect(raf.pendingCount).toBe(0);
  });

  it("eases the shine offset toward the current rotation", () => {
    const { rotation, shine } = mountShine();
    rotation.value = { x: 100, y: -100 };

    raf.advance();

    // 5% of the way on the first frame, matching the original easing.
    expect(shine.shineOffset.value.x).toBeCloseTo(5, 5);
    expect(shine.shineOffset.value.y).toBeCloseTo(-5, 5);
  });

  it("keeps easing toward the target across frames", () => {
    const { rotation, shine } = mountShine();
    rotation.value = { x: 100, y: 0 };

    raf.advance();
    raf.advance();

    expect(shine.shineOffset.value.x).toBeCloseTo(9.75, 5);
  });
});

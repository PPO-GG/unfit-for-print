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
  it("runs an animation frame loop while the shine is still chasing", () => {
    const { rotation } = mountShine();
    rotation.value = { x: 100, y: 0 };

    expect(raf.pendingCount).toBe(1);
    raf.advance();
    expect(raf.pendingCount).toBe(1);
  });

  // The ease is asymptotic, so the loop only ever stops if something declares
  // it close enough. Without that it kept writing to a deep-reactive ref every
  // frame, for every mounted card, forever — a full hand idling at a high
  // refresh rate was thousands of pointless reactive writes a second.
  it("idles without a loop when the card is never hovered", () => {
    mountShine();

    raf.advance();

    expect(raf.pendingCount).toBe(0);
  });

  it("stops the loop once the shine has caught up with the rotation", () => {
    const { rotation } = mountShine();
    rotation.value = { x: 1, y: 0 };

    // 5%/frame from 1 degree crosses the settle threshold in ~90 frames.
    for (let i = 0; i < 200; i++) raf.advance();

    expect(raf.pendingCount).toBe(0);
  });

  it("snaps exactly onto the rotation when it settles", () => {
    const { rotation, shine } = mountShine();
    rotation.value = { x: 1, y: -1 };

    for (let i = 0; i < 200; i++) raf.advance();

    expect(shine.shineOffset.value.x).toBe(1);
    expect(shine.shineOffset.value.y).toBe(-1);
  });

  it("restarts the loop when the rotation changes after settling", () => {
    const { rotation } = mountShine();
    raf.advance();
    expect(raf.pendingCount).toBe(0);

    rotation.value = { x: 10, y: 10 };

    expect(raf.pendingCount).toBe(1);
  });

  it("does not restart a settled loop when the effect is disabled", () => {
    const { rotation } = mountShine(false);
    expect(raf.pendingCount).toBe(0);

    rotation.value = { x: 10, y: 10 };

    expect(raf.pendingCount).toBe(0);
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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const gsap = vi.hoisted(() => ({ to: vi.fn(), fromTo: vi.fn(), set: vi.fn() }));
vi.mock("gsap", () => ({ gsap }));
const preference = ref<"reduce" | "no-preference">("no-preference");
vi.mock("@vueuse/core", async (orig) => ({
  ...(await orig<typeof import("@vueuse/core")>()),
  usePreferredReducedMotion: () => preference,
}));

import { useCompactMotion } from "~/composables/useCompactMotion";

const el = () => document.createElement("div");

describe("useCompactMotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preference.value = "no-preference";
  });

  it("deals cards in with movement by default", () => {
    useCompactMotion().dealIn([el(), el()]);
    const [, from] = gsap.fromTo.mock.calls[0]!;
    expect(from).toMatchObject({ y: 140, opacity: 0 });
  });

  it("degrades every effect to opacity under reduced motion", () => {
    preference.value = "reduce";
    const m = useCompactMotion();
    m.dealIn([el()]);
    m.dropIn(el());
    for (const [, from, to] of gsap.fromTo.mock.calls) {
      expect(Object.keys(from)).toEqual(["opacity"]);
      expect(to).not.toHaveProperty("y");
    }
    m.popSelect(el());
    m.bounce(el());
    m.fillBars([el()]);
    expect(gsap.fromTo).toHaveBeenCalledTimes(2); // only the two fades
  });

  it("calls onComplete immediately when there is nothing to fly", () => {
    const done = vi.fn();
    useCompactMotion().flyToPrompt([], null, done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("ignores missing targets", () => {
    const m = useCompactMotion();
    m.dealIn(null);
    m.crown(null, undefined);
    expect(gsap.fromTo).not.toHaveBeenCalled();
  });

  it("dropIn settles the card with rotation 0 and clears transforms", () => {
    useCompactMotion().dropIn([el()]);
    const [, , to] = gsap.fromTo.mock.calls[0]!;
    expect(to).toMatchObject({ rotation: 0, clearProps: "transform,opacity" });
  });

  it("flyToPrompt uses relative offsets and onComplete only on last card", () => {
    const target = document.createElement("div");
    const done = vi.fn();
    useCompactMotion().flyToPrompt([el(), el()], target, done);
    expect(gsap.to).toHaveBeenCalledTimes(2);
    const [, call0] = gsap.to.mock.calls[0]!;
    const [, call1] = gsap.to.mock.calls[1]!;
    expect(typeof call0.x).toBe("string");
    expect(typeof call0.y).toBe("string");
    expect(call0.x).toMatch(/^\+=/);
    expect(call0.y).toMatch(/^\+=/);
    expect(call0.onComplete).toBeUndefined();
    expect(call1.onComplete).toBe(done);
  });
});

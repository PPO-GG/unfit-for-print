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

  it("flyToPrompt flies ghost clones on <body>, never the originals, and cleans up", () => {
    const target = document.createElement("div");
    const done = vi.fn();
    const a = el();
    const b = el();
    const before = document.body.children.length;
    useCompactMotion().flyToPrompt([a, b], target, done);
    expect(gsap.to).toHaveBeenCalledTimes(2);
    const [t0, call0] = gsap.to.mock.calls[0]!;
    const [t1, call1] = gsap.to.mock.calls[1]!;
    expect(t0).not.toBe(a);
    expect(t1).not.toBe(b);
    expect(document.body.contains(t0)).toBe(true);
    expect(document.body.contains(t1)).toBe(true);
    expect(document.body.children.length).toBe(before + 2);
    expect((t0 as HTMLElement).style.position).toBe("fixed");
    expect(typeof call0.x).toBe("number");
    expect(typeof call0.y).toBe("number");
    expect(call0.onComplete).toBeUndefined();
    call1.onComplete();
    expect(done).toHaveBeenCalledTimes(1);
    expect(document.body.contains(t0)).toBe(false);
    expect(document.body.contains(t1)).toBe(false);
    expect(document.body.children.length).toBe(before);
  });

  it("flyToPrompt ghosts are hidden from AT and out of the tab order", () => {
    const a = el();
    a.setAttribute("tabindex", "0");
    const inner = document.createElement("button");
    inner.setAttribute("tabindex", "0");
    a.appendChild(inner);
    useCompactMotion().flyToPrompt([a], document.createElement("div"));
    const ghost = gsap.to.mock.calls[0]![0] as HTMLElement;
    expect(ghost.getAttribute("aria-hidden")).toBe("true");
    expect(ghost.hasAttribute("tabindex")).toBe(false);
    expect(ghost.querySelectorAll("[tabindex]")).toHaveLength(0);
    expect(a.getAttribute("tabindex")).toBe("0"); // the original is untouched
  });

  it("flyToPrompt fades the ghosts under reduced motion, then cleans up", () => {
    preference.value = "reduce";
    const done = vi.fn();
    const before = document.body.children.length;
    useCompactMotion().flyToPrompt([el()], document.createElement("div"), done);
    const [ghosts, vars] = gsap.to.mock.calls[0]!;
    expect(vars).toMatchObject({ opacity: 0, duration: 0.15 });
    expect(document.body.children.length).toBe(before + 1);
    vars.onComplete();
    expect(done).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(before);
    expect(ghosts).toHaveLength(1);
  });
});

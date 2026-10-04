import { gsap } from "gsap";
import { usePreferredReducedMotion } from "@vueuse/core";

type Targets = Element | Element[] | null | undefined;

function list(t: Targets): Element[] {
  if (!t) return [];
  return Array.isArray(t) ? t.filter(Boolean) : [t];
}

/**
 * The compact view's motion: short, springy, transform/opacity only so it
 * stays smooth inside the Discord Activity on mid-range phones. Under
 * prefers-reduced-motion every effect is an opacity fade or nothing.
 */
export function useCompactMotion() {
  const preference = usePreferredReducedMotion();
  const reduced = () => preference.value === "reduce";

  function fade(els: Element[]) {
    gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.2, overwrite: "auto", clearProps: "opacity" });
  }

  function dealIn(t: Targets) {
    const els = list(t);
    if (!els.length) return;
    if (reduced()) return fade(els);
    gsap.fromTo(
      els,
      { y: 140, rotation: (i: number) => (i % 2 ? 8 : -8), opacity: 0 },
      { y: 0, rotation: 0, opacity: 1, duration: 0.55, ease: "back.out(1.6)", stagger: 0.06, overwrite: "auto" },
    );
  }

  function popSelect(t: Targets) {
    const els = list(t);
    if (!els.length || reduced()) return;
    gsap.fromTo(els, { scale: 0.92 }, { scale: 1, duration: 0.35, ease: "back.out(3)", overwrite: "auto" });
  }

  /**
   * Flies GHOST copies of the cards to the prompt. The real slides sit inside
   * the carousel's overflow-clipped scroll track, which would cut the flight
   * off, so each card is cloned onto <body> at its on-screen rect and the
   * clone travels. The originals are never touched.
   */
  function flyToPrompt(t: Targets, target: Element | null, onComplete?: () => void) {
    const els = list(t);
    if (!els.length || !target) {
      onComplete?.();
      return;
    }
    const to = target.getBoundingClientRect();
    const ghosts = els.map((el) => {
      const r = el.getBoundingClientRect();
      const clone = el.cloneNode(true) as HTMLElement;
      clone.classList.add("lobby-tokens");
      // A ghost is decoration: hide it from AT and take it (and its children) out of the tab order.
      clone.setAttribute("aria-hidden", "true");
      clone.removeAttribute("tabindex");
      clone.querySelectorAll("[tabindex]").forEach((n) => n.removeAttribute("tabindex"));
      Object.assign(clone.style, {
        position: "fixed",
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        margin: "0",
        zIndex: "60",
        pointerEvents: "none",
      });
      document.body.appendChild(clone);
      return { clone, r };
    });
    const finish = () => {
      ghosts.forEach(({ clone }) => clone.remove());
      onComplete?.();
    };
    if (reduced()) {
      gsap.to(
        ghosts.map((g) => g.clone),
        { opacity: 0, duration: 0.15, onComplete: finish },
      );
      return;
    }
    ghosts.forEach(({ clone, r }, i) => {
      const dx = to.left + to.width / 2 - (r.left + r.width / 2);
      const dy = to.top + to.height / 2 - (r.top + r.height / 2);
      gsap.to(clone, {
        x: dx,
        y: dy,
        scale: 0.3,
        rotation: i % 2 ? 10 : -10,
        opacity: 0,
        duration: 0.45,
        delay: i * 0.05,
        ease: "power2.in",
        onComplete: i === ghosts.length - 1 ? finish : undefined,
      });
    });
  }

  function bounce(t: Targets) {
    const els = list(t);
    if (!els.length || reduced()) return;
    gsap.fromTo(els, { y: 0 }, { y: -6, duration: 0.18, yoyo: true, repeat: 1, ease: "power1.out" });
  }

  function crown(winner: Element | null, others: Targets) {
    const rest = list(others);
    if (reduced()) {
      if (rest.length) gsap.to(rest, { opacity: 0.35, duration: 0.2 });
      return;
    }
    if (winner) gsap.to(winner, { scale: 1.08, y: -10, duration: 0.5, ease: "elastic.out(1, 0.5)" });
    if (rest.length) {
      gsap.to(rest, { opacity: 0.25, y: 24, scale: 0.94, duration: 0.4, ease: "power2.out", stagger: 0.04 });
    }
  }

  function dropIn(t: Targets) {
    const els = list(t);
    if (!els.length) return;
    if (reduced()) return fade(els);
    gsap.fromTo(
      els,
      { y: -80, rotation: -6, opacity: 0 },
      { y: 0, rotation: 0, opacity: 1, duration: 0.6, ease: "back.out(1.4)", clearProps: "transform,opacity" },
    );
  }

  function fillBars(t: Targets) {
    const els = list(t);
    if (!els.length || reduced()) return;
    gsap.fromTo(
      els,
      { scaleX: 0 },
      { scaleX: 1, transformOrigin: "left center", duration: 0.8, ease: "elastic.out(1, 0.6)", stagger: 0.05, delay: 0.3 },
    );
  }

  return { reduced, dealIn, popSelect, flyToPrompt, bounce, crown, dropIn, fillBars };
}

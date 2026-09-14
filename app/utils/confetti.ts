/**
 * The one confetti cannon every celebration fires through.
 *
 * canvas-confetti's default export animates inside a Web Worker on an
 * OffscreenCanvas, and it tears its canvas out of the DOM after every burst
 * and transfers a fresh one to that same worker next time. Completion is a
 * worker → main-thread message, so a burst fired while that message is in
 * flight starts animating on a canvas the main thread is about to detach. In
 * the Discord Activity (issue #118) that left the worker's frame loop stalled
 * and the last drawn frame frozen over the table for the rest of the game.
 *
 * A main-thread cannon has neither the message race nor the OffscreenCanvas
 * placeholder, and one shared instance means every call site adds particles
 * to the same animation instead of each owning a canvas. `resetConfetti()` is
 * the backstop: it clears whatever is on the canvas regardless of cause.
 */
import confetti from "canvas-confetti";

let cannon: confetti.CreateTypes | null = null;

function getCannon(): confetti.CreateTypes {
  if (!cannon) {
    cannon = confetti.create(undefined, { resize: true, useWorker: false });
  }
  return cannon;
}

export function burstConfetti(options: confetti.Options) {
  if (typeof window === "undefined") return;
  getCannon()(options);
}

/** Stop every in-flight burst and clear the canvas. */
export function resetConfetti() {
  cannon?.reset();
}

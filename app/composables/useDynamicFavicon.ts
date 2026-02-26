// composables/useDynamicFavicon.ts
// Dynamically renders a canvas-based favicon showing round number and turn status.
// Restores the original static favicon on cleanup.

import { watch, onMounted, onBeforeUnmount, type ComputedRef } from "vue";
import type { GameState } from "~/types/game";

interface DynamicFaviconOptions {
  /** Decoded game state (null when not in-game) */
  state: ComputedRef<GameState | null>;
  /** Whether the current user is the judge this round */
  isJudge: ComputedRef<boolean>;
  /** Whether it's the submitting phase */
  isSubmitting: ComputedRef<boolean>;
  /** Whether it's the judging phase */
  isJudging: ComputedRef<boolean>;
  /** Whether the round just ended */
  isRoundEnd: ComputedRef<boolean>;
  /** Whether the game is complete */
  isComplete: ComputedRef<boolean>;
  /** Whether the current user has already submitted */
  hasSubmitted: ComputedRef<boolean>;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const FAVICON_SIZE = 64; // Higher res for retina, browsers downscale
const BADGE_RADIUS = 14;
const DOT_RADIUS = 8;

// Colors
const COLORS = {
  badgeBg: "#7c3aed", // Purple — matches game accent
  badgeText: "#ffffff",
  dotSubmit: "#22c55e", // Green — your turn to play
  dotJudge: "#a855f7", // Purple — you're the judge
  dotRoundEnd: "#f59e0b", // Amber — round ending
  dotComplete: "#ef4444", // Red — game over
  dotWaiting: "#64748b", // Slate — waiting for others
} as const;

export function useDynamicFavicon(options: DynamicFaviconOptions) {
  if (import.meta.server) return;

  const {
    state,
    isJudge,
    isSubmitting,
    isJudging,
    isRoundEnd,
    isComplete,
    hasSubmitted,
  } = options;

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let baseImage: HTMLImageElement | null = null;
  let baseImageLoaded = false;
  let originalFaviconHref: string | null = null;
  let pulseActive = false;

  // ─── Setup ──────────────────────────────────────────────────────────────
  function init() {
    // Save the original favicon href for restoration
    const existingLink =
      document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (existingLink) {
      originalFaviconHref = existingLink.href;
    }

    // Create offscreen canvas
    canvas = document.createElement("canvas");
    canvas.width = FAVICON_SIZE;
    canvas.height = FAVICON_SIZE;
    ctx = canvas.getContext("2d");

    // Load the base SVG
    baseImage = new Image();
    baseImage.onload = () => {
      baseImageLoaded = true;
      drawFavicon();
    };
    baseImage.onerror = () => {
      console.warn(
        "[useDynamicFavicon] Failed to load base SVG, falling back to text-only favicon",
      );
      baseImageLoaded = false;
      drawFavicon();
    };
    baseImage.src = "/img/ufp2.svg";
  }

  // ─── Determine status ─────────────────────────────────────────────────
  function getStatusDot(): {
    color: string;
    pulse: boolean;
    label: string;
  } | null {
    if (!state.value || state.value.phase === "waiting") return null;

    if (isComplete.value) {
      return { color: COLORS.dotComplete, pulse: false, label: "Game Over" };
    }
    if (isRoundEnd.value) {
      return { color: COLORS.dotRoundEnd, pulse: true, label: "Round End" };
    }
    if (isJudging.value && isJudge.value) {
      return { color: COLORS.dotJudge, pulse: true, label: "Your Pick" };
    }
    if (isJudging.value) {
      return { color: COLORS.dotWaiting, pulse: false, label: "Judging" };
    }
    // Judge during submitting — they're just waiting for players
    if (isSubmitting.value && isJudge.value) {
      return { color: COLORS.dotJudge, pulse: false, label: "Judging" };
    }
    if (isSubmitting.value && !hasSubmitted.value) {
      return { color: COLORS.dotSubmit, pulse: true, label: "Your Turn" };
    }
    if (isSubmitting.value && hasSubmitted.value) {
      return { color: COLORS.dotWaiting, pulse: false, label: "Waiting" };
    }

    return null;
  }

  // ─── Draw ─────────────────────────────────────────────────────────────
  function drawFavicon(pulseScale = 1) {
    if (!ctx || !canvas) return;
    const round = state.value?.round ?? null;
    const dot = getStatusDot();

    // Clear
    ctx.clearRect(0, 0, FAVICON_SIZE, FAVICON_SIZE);

    // Draw base image
    if (baseImageLoaded && baseImage) {
      // Add slight padding so badges don't clip
      const pad = 4;
      ctx.drawImage(
        baseImage,
        pad,
        pad,
        FAVICON_SIZE - pad * 2,
        FAVICON_SIZE - pad * 2,
      );
    } else {
      // Fallback: dark rounded rect
      ctx.fillStyle = "#1c2342";
      roundRect(ctx, 2, 2, FAVICON_SIZE - 4, FAVICON_SIZE - 4, 10);
      ctx.fill();
    }

    // Draw round badge (top-right)
    if (round !== null && round > 0) {
      const bx = FAVICON_SIZE - BADGE_RADIUS - 2;
      const by = BADGE_RADIUS + 2;

      // Shadow for depth
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Badge circle
      ctx.fillStyle = COLORS.badgeBg;
      ctx.beginPath();
      ctx.arc(bx, by, BADGE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, BADGE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      // Number text
      ctx.fillStyle = COLORS.badgeText;
      ctx.font = `bold ${round > 9 ? 14 : 18}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(round > 99 ? "99+" : String(round), bx, by + 1);
    }

    // Draw status dot (bottom-left)
    if (dot) {
      const dx = DOT_RADIUS + 4;
      const dy = FAVICON_SIZE - DOT_RADIUS - 4;
      const radius = DOT_RADIUS * (dot.pulse ? pulseScale : 1);

      // Glow effect for pulsing dots
      if (dot.pulse) {
        ctx.save();
        ctx.shadowColor = dot.color;
        ctx.shadowBlur = 8 * pulseScale;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = dot.color;
        ctx.beginPath();
        ctx.arc(dx, dy, radius + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Main dot
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 3;
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(dx, dy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // White ring
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(dx, dy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Apply to document
    applyFavicon(canvas.toDataURL("image/png"));
  }

  // ─── Pulse Animation ──────────────────────────────────────────────────
  // Use a slow interval instead of rAF — favicons are tiny and don't need 60fps.
  // A 2-state blink at ~500ms is more attention-grabbing in a browser tab anyway.
  let pulseIntervalId: ReturnType<typeof setInterval> | null = null;

  function startPulse() {
    if (pulseActive) return;
    pulseActive = true;

    let t = 0;
    drawFavicon(1); // Initial draw
    pulseIntervalId = setInterval(() => {
      t += 0.5;
      const scale = 1 + 0.15 * Math.sin(t);
      drawFavicon(scale);
    }, 500);
  }

  function stopPulse() {
    pulseActive = false;
    if (pulseIntervalId !== null) {
      clearInterval(pulseIntervalId);
      pulseIntervalId = null;
    }
  }

  // ─── DOM Helpers ──────────────────────────────────────────────────────
  function applyFavicon(dataUrl: string) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/png";
    link.href = dataUrl;
  }

  function restoreFavicon() {
    stopPulse();
    if (originalFaviconHref) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (link) {
        link.href = originalFaviconHref;
        link.type = "image/png";
      }
    }
  }

  function roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  // ─── Reactive Watchers ────────────────────────────────────────────────
  onMounted(() => {
    init();
  });

  // Redraw when game state changes
  watch(
    [() => state.value?.round, () => state.value?.phase, isJudge, hasSubmitted],
    () => {
      const dot = getStatusDot();
      if (dot?.pulse) {
        startPulse();
      } else {
        stopPulse();
        drawFavicon();
      }
    },
    { flush: "post" },
  );

  // ─── Cleanup ──────────────────────────────────────────────────────────
  onBeforeUnmount(() => {
    restoreFavicon();
    canvas = null;
    ctx = null;
    baseImage = null;
  });
}

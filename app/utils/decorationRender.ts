import { inject, ref, type CSSProperties, type InjectionKey, type Ref } from "vue";
import type { ParticleShape, Transform } from "#shared/decorationLayers";

/** DecorationStack measures the avatar once and provides its width here. */
export const AVATAR_PX_KEY: InjectionKey<Ref<number>> = Symbol("deco-avatar-px");

export function useAvatarPx(): Ref<number> {
  return inject(AVATAR_PX_KEY, ref(48));
}

/** A scale×avatar box centred on the avatar, then offset and rotated. */
export function transformStyle(t: Transform, avatarPx: number): CSSProperties {
  const size = Math.round(avatarPx * t.scale);
  return {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${size}px`,
    height: `${size}px`,
    transform: `translate(-50%, -50%) translate(${t.x * avatarPx}px, ${t.y * avatarPx}px) rotate(${t.rotation}deg)`,
  };
}

/** Custom properties consumed by the shared keyframes in decorations.css. */
export function animVars(duration: number, direction?: "cw" | "ccw", delay?: number): Record<string, string> {
  return {
    "--deco-dur": `${duration}s`,
    "--deco-dir": direction === "ccw" ? "reverse" : "normal",
    ...(delay !== undefined ? { "--deco-delay": `${delay}s` } : {}),
  };
}

/** 24×24 viewBox paths for the built-in particle shapes. */
export const SHAPE_PATHS: Record<Exclude<ParticleShape, "image">, string> = {
  sparkle: "M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41Z",
  star: "M12 1l3.1 6.9 7.4.8-5.6 5 1.6 7.3L12 17.3 5.5 21l1.6-7.3-5.6-5 7.4-.8z",
  dot: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z",
  heart: "M12 21s-7.5-4.6-9.6-9.3C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.2C19.5 16.4 12 21 12 21z",
  plus: "M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8z",
};

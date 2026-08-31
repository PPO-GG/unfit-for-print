// composables/useSfx.ts
import {
  getRandomInt,
  getRandomFloat,
  getRandomInRange as getCryptoRandomInRange,
} from "~/composables/useCrypto";
import { useUserPrefsStore } from "~/stores/userPrefsStore";
import { normalizeVolumePercent } from "~/utils/volume";

/**
 * Represents options for sound effects (SFX).
 * - `volume`: Sets the volume of the sound. Can be a single number or an array*/
interface SfxOptions {
  volume?: number | [number, number];
  pitch?: number | [number, number];
  id?: string;
}

/**
 *
 */
interface SpriteMap {
  [key: string]: [startMs: number, durationMs: number];
}

export function computeSfxGain(
  masterVolumePercent: number,
  perCallVolume?: number | [number, number],
): number {
  const baseVolume =
    perCallVolume === undefined ? 1 : getCryptoRandomInRange(perCallVolume);
  return normalizeVolumePercent(masterVolumePercent) * baseVolume;
}

// ── Shared singleton state ─────────────────────────────────────────
// `useSfx()` is called from many component instances (e.g. once per
// card in a hand). All of them share a single AudioContext and a
// single decode cache below, so a sound is only ever fetched/decoded
// once no matter how many components request it, and no AudioContext
// instances get leaked as cards mount/unmount.
let sharedAudioContext: AudioContext | null = null;
const bufferCache = new Map<string, Promise<AudioBuffer>>();
const spriteCache = new Map<string, Promise<AudioBuffer>>();
let gestureUnlockAttached = false;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }
  // Browsers create AudioContexts in a "suspended" state until a user
  // gesture unlocks them. Resume on the first interaction instead of
  // relying on each caller to do it.
  if (!gestureUnlockAttached) {
    gestureUnlockAttached = true;
    const resume = () => {
      sharedAudioContext?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
  }
  return sharedAudioContext;
}

async function fetchAudioBuffer(
  ctx: AudioContext,
  src: string,
): Promise<AudioBuffer> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(
      `Audio file not found or failed to load: ${src} (${response.status})`,
    );
  }
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error(
      `Failed to load audio: ${src} returned an HTML page instead of an audio file`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

/** Loads (or returns the in-flight/cached load of) an individual SFX file. */
function loadBuffer(file: string): Promise<AudioBuffer> {
  let pending = bufferCache.get(file);
  if (!pending) {
    const ctx = getAudioContext();
    pending = fetchAudioBuffer(ctx, file).catch((err) => {
      bufferCache.delete(file);
      throw err;
    });
    bufferCache.set(file, pending);
  }
  return pending;
}

/** Loads (or returns the in-flight/cached load of) a sprite sheet. */
function loadSpriteBuffer(src: string): Promise<AudioBuffer> {
  let pending = spriteCache.get(src);
  if (!pending) {
    const ctx = getAudioContext();
    pending = fetchAudioBuffer(ctx, src).catch((err) => {
      spriteCache.delete(src);
      throw err;
    });
    spriteCache.set(src, pending);
  }
  return pending;
}

/**
 * Warms the shared decode cache for a set of individual SFX entries
 * (as found in `SFX` from `~/config/sfx.config`), so the first time a
 * sound is actually played there's no fetch/decode latency. Safe to
 * call more than once — already-cached/in-flight files are skipped.
 */
export function preloadSfx(entries: Array<string | string[]>) {
  if (!import.meta.client) return;
  for (const entry of entries.flat()) {
    loadBuffer(entry).catch((err) => {
      if (import.meta.dev) console.warn("Failed to preload audio:", entry, err);
    });
  }
}

/**
 *
 */
export const useSfx = (spriteSrc?: string, spriteMap?: SpriteMap) => {
  if (!import.meta.client) {
    const playSfx = async () => {};
    return { playSfx };
  }

  const prefs = useUserPrefsStore();
  const spriteBufferPromise = spriteSrc ? loadSpriteBuffer(spriteSrc) : null;

  const playSfx = async (src: string | string[], options: SfxOptions = {}) => {
    const audioContext = getAudioContext();
    let bufferSource: AudioBufferSourceNode | null = null;
    let gainNode: GainNode | null = null;

    if (spriteBufferPromise && spriteMap) {
      let spriteAudioBuffer: AudioBuffer;
      try {
        spriteAudioBuffer = await spriteBufferPromise;
      } catch (err) {
        if (import.meta.dev) console.warn("Failed to load sprite audio:", err);
        return;
      }

      let spriteToPlay: string | null = null;

      if (options.id) {
        spriteToPlay = options.id;
      } else {
        const spriteKeys = Object.keys(spriteMap);
        if (spriteKeys.length > 0) {
          const key = spriteKeys[getRandomInt(spriteKeys.length)];
          spriteToPlay = key || null;
        }
      }

      const spriteData = spriteToPlay ? spriteMap[spriteToPlay] : undefined;
      if (spriteToPlay && spriteData) {
        const [startMs, durationMs] = spriteData;
        const startSec = startMs / 1000;
        const durationSec = durationMs / 1000;

        bufferSource = audioContext.createBufferSource();
        bufferSource.buffer = spriteAudioBuffer;
        bufferSource.start(0, startSec, durationSec);

        gainNode = audioContext.createGain();
        bufferSource.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (options.pitch !== undefined) {
          bufferSource.playbackRate.value = getCryptoRandomInRange(
            options.pitch,
          );
        }

        gainNode.gain.value = computeSfxGain(prefs.sfxVolume, options.volume);
      }
    } else {
      const file = Array.isArray(src) ? src[getRandomInt(src.length)] : src;
      if (!file) return;

      let buffer: AudioBuffer;
      try {
        buffer = await loadBuffer(file);
      } catch (err: any) {
        if (import.meta.dev)
          console.warn("Failed to load audio:", err?.message || err);
        return;
      }

      bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = buffer;
      bufferSource.start(0);

      gainNode = audioContext.createGain();
      bufferSource.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (options.pitch !== undefined) {
        bufferSource.playbackRate.value = getCryptoRandomInRange(options.pitch);
      }

      gainNode.gain.value = computeSfxGain(prefs.sfxVolume, options.volume);
    }
  };

  return { playSfx };
};

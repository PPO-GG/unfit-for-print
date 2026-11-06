import { TTS_PROVIDERS } from "../../app/constants/ttsProviders";
import { consumeRateLimit } from "~~/server/utils/rateLimit";
import { requireAuth } from "~~/server/utils/session";

// Derived from the client's voice list rather than kept as a second copy: a
// hand-maintained list here drifted once already, and the voice picker offered
// a voice (bm_v0lewis) this route rejected with "Invalid voice".
export const KOKORO_ALLOWED_VOICES: ReadonlySet<string> = new Set(
  Object.values(TTS_PROVIDERS)
    .filter((p) => p.id.startsWith("kokoro-"))
    .map((p) => p.apiVoice),
);

// Kokoro has no auth of its own, so this route is the only gate in front of
// it. On 2026-11-04 it took 464 requests in ~40 s, 133 of them inside 72 ms —
// far beyond what useSpeech's one-at-a-time queue sends. One read-aloud per
// round plus some voice-preview clicks fits well inside the per-user limit;
// the global one protects the single Kokoro box from many accounts at once.
const WINDOW_MS = 60_000;
const PER_USER_LIMIT = 20;
const GLOBAL_LIMIT = 300;
const UPSTREAM_TIMEOUT_MS = 30_000;

/** Kokoro's base URL. Set NUXT_KOKORO_URL to its private address so the
 *  public hostname can be removed; unset keeps the public one. */
function kokoroUrl(): string {
  const base = process.env.NUXT_KOKORO_URL || "https://kokoro.ppo.gg";
  return `${base.replace(/\/+$/, "")}/v1/audio/speech`;
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { text, voice, speed } = await readBody(event) as { text: string; voice: string; speed?: number };

  if (!text || !voice) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: text and voice',
    });
  }

  if (text.length > 1000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Text too long (max 1000 characters)',
    });
  }

  if (!KOKORO_ALLOWED_VOICES.has(voice)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid voice',
    });
  }

  for (const [key, limit] of [
    [`tts:kokoro:${userId}`, PER_USER_LIMIT],
    ["tts:kokoro:global", GLOBAL_LIMIT],
  ] as const) {
    const rateLimit = consumeRateLimit(key, { limit, windowMs: WINDOW_MS });
    if (!rateLimit.allowed) {
      setResponseHeader(event, "Retry-After", rateLimit.retryAfterSeconds);
      throw createError({ statusCode: 429, statusMessage: "Too many TTS requests" });
    }
  }

  let resp: Response;
  try {
    resp = await fetch(kokoroUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        voice,
        input: text,
        ...(speed != null && { speed: Math.min(2, Math.max(0.5, speed)) }),
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[kokoro-speak] upstream unreachable:", err);
    throw createError({ statusCode: 502, statusMessage: "TTS upstream unreachable" });
  }

  if (!resp.ok) {
    // Kokoro's error body is often a whole HTML page. Log a slice, never
    // forward it: it became an issue title once.
    const body = await resp.text().catch(() => "");
    console.error(`[kokoro-speak] upstream ${resp.status}:`, body.slice(0, 200));
    throw createError({
      statusCode: 502,
      statusMessage: `TTS upstream error (${resp.status})`,
    });
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  setResponseHeader(event, 'Content-Type', 'audio/mpeg');
  return buffer;
});

import { TTS_PROVIDERS } from "../../app/constants/ttsProviders";

// Derived from the client's voice list rather than kept as a second copy: a
// hand-maintained list here drifted once already, and the voice picker offered
// a voice (bm_v0lewis) this route rejected with "Invalid voice".
export const KOKORO_ALLOWED_VOICES: ReadonlySet<string> = new Set(
  Object.values(TTS_PROVIDERS)
    .filter((p) => p.id.startsWith("kokoro-"))
    .map((p) => p.apiVoice),
);

export default defineEventHandler(async (event) => {
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

  const resp = await fetch('https://kokoro.ppo.gg/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'kokoro',
      voice,
      input: text,
      ...(speed != null && { speed: Math.min(2, Math.max(0.5, speed)) }),
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw createError({ statusCode: resp.status, statusMessage: err });
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  setResponseHeader(event, 'Content-Type', 'audio/mpeg');
  return buffer;
});

export default defineEventHandler(async (event) => {
  const { text, voice } = await readBody(event) as { text: string; voice: string };

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

  const ALLOWED_VOICES = [
    'af_heart', 'af_bella', 'af_nicole', 'af_aoede', 'af_kore',
    'af_sarah', 'af_alloy', 'af_nova', 'am_fenrir', 'am_michael',
    'am_puck', 'bf_emma', 'bf_isabella', 'bm_fable', 'bm_george', 'ff_siwis',
  ];

  if (!ALLOWED_VOICES.includes(voice)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid voice',
    });
  }

  const resp = await fetch('https://kokoro.ppo.gg/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'kokoro', voice, input: text }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw createError({ statusCode: resp.status, statusMessage: err });
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  setResponseHeader(event, 'Content-Type', 'audio/mpeg');
  return buffer;
});

export default defineEventHandler(async (event) => {
  // Require an authenticated session to prevent free-riders burning Google TTS credits.
  await requireAuth(event);

  const { text, voiceName } = await readBody(event) as {
    text: string;
    voiceName: string;
  };

  if (!text || !voiceName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: text and voiceName',
    });
  }

  const ALLOWED_VOICES = [
    'en-US-Neural2-A', 'en-US-Neural2-C', 'en-US-Neural2-D', 'en-US-Neural2-E', 'en-US-Neural2-F',
    'en-AU-Neural2-A', 'en-AU-Neural2-B', 'en-AU-Neural2-C', 'en-AU-Neural2-D',
    'en-GB-Neural2-A', 'en-GB-Neural2-B', 'en-GB-Neural2-C', 'en-GB-Neural2-D', 'en-GB-Neural2-F',
  ];
  if (!ALLOWED_VOICES.includes(voiceName)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid voiceName',
    });
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Google TTS API key not configured',
    });
  }

  // Extract language code from voice name (e.g. 'en-US-Neural2-D' → 'en-US')
  const languageCode = voiceName.split('-').slice(0, 2).join('-');

  const resp = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: voiceName },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw createError({ statusCode: resp.status, statusMessage: err });
  }

  const { audioContent } = await resp.json() as { audioContent: string };
  const buffer = Buffer.from(audioContent, 'base64');

  setResponseHeader(event, 'Content-Type', 'audio/mpeg');
  return buffer;
});

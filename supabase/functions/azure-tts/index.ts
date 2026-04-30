// deno-lint-ignore-file no-explicit-any
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_VOICE = 'ja-JP-NanamiNeural';
const DEFAULT_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

function escapeXml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildSsml(text: string, voice: string, rate: string, pitch: string): string {
  return `<speak version='1.0' xml:lang='ja-JP'><voice name='${escapeXml(voice)}'><prosody rate='${escapeXml(rate)}' pitch='${escapeXml(pitch)}'>${escapeXml(text)}</prosody></voice></speak>`;
}

function getAzureConfig() {
  const key = Deno.env.get('AZURE_SPEECH_KEY')?.trim();
  const region = Deno.env.get('AZURE_SPEECH_REGION')?.trim();
  const defaultVoice = Deno.env.get('AZURE_SPEECH_VOICE')?.trim() || DEFAULT_VOICE;
  if (!key || !region) return null;
  return { key, region, defaultVoice };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const config = getAzureConfig();
    if (!config) {
      return new Response(JSON.stringify({ error: 'Azure Speech configuration is missing.' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as {
      text?: unknown;
      voice?: unknown;
      rate?: unknown;
      pitch?: unknown;
    };

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (text.length > 2000) {
      return new Response(JSON.stringify({ error: 'text is too long (max 2000 chars)' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const voice = typeof body.voice === 'string' && body.voice.trim()
      ? body.voice.trim()
      : config.defaultVoice;
    const rate = typeof body.rate === 'string' && body.rate.trim() ? body.rate.trim() : '-20%';
    const pitch = typeof body.pitch === 'string' && body.pitch.trim() ? body.pitch.trim() : 'default';

    const azureUrl = `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ssml = buildSsml(text, voice, rate, pitch);

    const azureResponse = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': DEFAULT_OUTPUT_FORMAT,
        'User-Agent': 'talk-gemini-pro-pronunciation-checker',
      },
      body: ssml,
    });

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      return new Response(JSON.stringify({
        error: 'Azure TTS request failed',
        status: azureResponse.status,
        detail: errorText.slice(0, 400),
      }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const audioBytes = await azureResponse.arrayBuffer();
    if (audioBytes.byteLength === 0) {
      return new Response(JSON.stringify({
        error: 'Azure TTS returned empty audio.',
      }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(audioBytes, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? 'Unknown error' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

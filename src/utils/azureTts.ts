export interface AzureTtsOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
}

export function buildAzureTtsEndpoint(): string | null {
  const explicit = import.meta.env.VITE_SUPABASE_AZURE_TTS_URL as string | undefined;
  if (explicit) return explicit;

  const transliterateUrl = import.meta.env.VITE_SUPABASE_TRANSLITERATE_URL as string | undefined;
  if (!transliterateUrl) return null;
  if (!transliterateUrl.endsWith('/transliterate')) return null;
  return transliterateUrl.replace(/\/transliterate$/, '/azure-tts');
}

export async function synthesizeAzureSpeech(text: string, options: AzureTtsOptions = {}): Promise<Blob> {
  const endpoint = buildAzureTtsEndpoint();
  if (!endpoint) {
    throw new Error('Azure TTS API endpoint is not configured.');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Text is empty.');
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (anonKey) {
    headers.apikey = anonKey;
    headers.Authorization = `Bearer ${anonKey}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text: trimmed,
      voice: options.voice,
      rate: options.rate,
      pitch: options.pitch,
    }),
  });

  if (!response.ok) {
    let message = 'Azure TTS request failed.';
    try {
      const payload = await response.json() as { error?: string; detail?: string };
      if (payload.error) {
        message = payload.detail ? `${payload.error}: ${payload.detail}` : payload.error;
      }
    } catch {
      // Ignore JSON parsing errors and keep default message.
    }
    throw new Error(message);
  }

  const audioBlob = await response.blob();
  if (!audioBlob.size) {
    throw new Error('Azure TTS returned empty audio.');
  }
  return audioBlob;
}

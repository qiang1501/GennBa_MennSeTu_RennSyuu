import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildSaveReadingEndpoint,
  extractEnglishWords,
  fallbackRomanToKatakana,
  normalizeEnglishWordKey,
  saveCustomReading,
  transliterateEnglishWords,
} from './englishKatakana';

describe('extractEnglishWords', () => {
  it('extracts unique english words from mixed Japanese text', () => {
    const words = extractEnglishWords('JavaとWebを学ぶ。JAVA + TypeScript + web');
    expect(words).toEqual(['Java', 'Web', 'TypeScript']);
  });

  it('keeps trailing digits for certification names like N1', () => {
    const words = extractEnglishWords('JLPT N1 と AZ-900');
    expect(words).toEqual(['JLPT', 'N1', 'AZ900']);
  });
});

describe('normalizeEnglishWordKey', () => {
  it('keeps digits when building dictionary keys', () => {
    expect(normalizeEnglishWordKey('N1')).toBe('n1');
    expect(normalizeEnglishWordKey('AZ-900')).toBe('az900');
  });
});

describe('fallbackRomanToKatakana', () => {
  it('converts common English words to katakana-ish readings', () => {
    expect(fallbackRomanToKatakana('Java')).toBe('ジャバ');
    expect(fallbackRomanToKatakana('Web')).toBe('ウェブ');
  });
});

describe('transliterateEnglishWords', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses local fallback when Supabase endpoint is not configured', async () => {
    const result = await transliterateEnglishWords(['Java', 'Web']);

    expect(result.java).toBe('ジャバ');
    expect(result.web).toBe('ウェブ');
  });

  it('merges Supabase response and fallback result', async () => {
    vi.stubEnv('VITE_SUPABASE_TRANSLITERATE_URL', 'https://example.com/transliterate');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { word: 'Java', katakana: 'ジャヴァ' },
          ],
        }),
      }),
    );

    const result = await transliterateEnglishWords(['Java', 'Web']);
    expect(result.java).toBe('ジャヴァ');
    expect(result.web).toBe('ウェブ');
  });
});

describe('saveCustomReading', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('derives save endpoint from transliterate endpoint', () => {
    vi.stubEnv('VITE_SUPABASE_TRANSLITERATE_URL', 'https://example.com/functions/v1/transliterate');
    expect(buildSaveReadingEndpoint()).toBe('https://example.com/functions/v1/save-reading');
  });

  it('posts custom reading to save API', async () => {
    vi.stubEnv('VITE_SUPABASE_TRANSLITERATE_URL', 'https://example.com/functions/v1/transliterate');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await saveCustomReading('AWS', 'エーダブリューエス', 'user-access-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/functions/v1/save-reading');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer user-access-token',
      }),
      body: JSON.stringify({
        word: 'AWS',
        reading: 'エーダブリューエス',
      }),
    });
  });
});

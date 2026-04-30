// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DICTIONARY: Record<string, string> = {
  java: '\u30b8\u30e3\u30d0',
  web: '\u30a6\u30a7\u30d6',
  javascript: '\u30b8\u30e3\u30d0\u30b9\u30af\u30ea\u30d7\u30c8',
  typescript: '\u30bf\u30a4\u30d7\u30b9\u30af\u30ea\u30d7\u30c8',
  github: '\u30ae\u30c3\u30c8\u30cf\u30d6',
  supabase: '\u30b9\u30fc\u30d1\u30fc\u30d9\u30fc\u30b9',
  react: '\u30ea\u30a2\u30af\u30c8',
};

const ROMAN_TO_KATAKANA: Array<[RegExp, string]> = [
  [/tch/g, '\u30c3\u30c1'],
  [/sch/g, '\u30b7\u30e5'],
  [/ja/g, '\u30b8\u30e3'],
  [/je/g, '\u30b8\u30a7'],
  [/ji/g, '\u30b8'],
  [/jo/g, '\u30b8\u30e7'],
  [/ju/g, '\u30b8\u30e5'],
  [/we/g, '\u30a6\u30a7'],
  [/wi/g, '\u30a6\u30a3'],
  [/wo/g, '\u30a6\u30a9'],
  [/wh/g, '\u30a6'],
  [/va/g, '\u30d0'],
  [/vi/g, '\u30d3'],
  [/vu/g, '\u30d6'],
  [/ve/g, '\u30d9'],
  [/vo/g, '\u30dc'],
  [/fa/g, '\u30d5\u30a1'],
  [/fi/g, '\u30d5\u30a3'],
  [/fe/g, '\u30d5\u30a7'],
  [/fo/g, '\u30d5\u30a9'],
  [/sh/g, '\u30b7'],
  [/ch/g, '\u30c1'],
  [/th/g, '\u30b9'],
  [/ph/g, '\u30d5'],
  [/qu/g, '\u30af'],
  [/ck/g, '\u30c3\u30af'],
  [/ng/g, '\u30f3\u30b0'],
  [/a/g, '\u30a2'],
  [/i/g, '\u30a4'],
  [/u/g, '\u30a6'],
  [/e/g, '\u30a8'],
  [/o/g, '\u30aa'],
  [/b/g, '\u30d6'],
  [/c/g, '\u30af'],
  [/d/g, '\u30c9'],
  [/f/g, '\u30d5'],
  [/g/g, '\u30b0'],
  [/h/g, '\u30d5'],
  [/j/g, '\u30b8'],
  [/k/g, '\u30af'],
  [/l/g, '\u30eb'],
  [/m/g, '\u30e0'],
  [/n/g, '\u30f3'],
  [/p/g, '\u30d7'],
  [/r/g, '\u30eb'],
  [/s/g, '\u30b9'],
  [/t/g, '\u30c8'],
  [/v/g, '\u30d6'],
  [/w/g, '\u30a6'],
  [/x/g, '\u30af\u30b9'],
  [/y/g, '\u30a4'],
  [/z/g, '\u30ba'],
];

function normalizeWord(word: string): string {
  return word
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_'’`".,\\/]+/g, '');
}

function heuristicKatakana(word: string): string {
  let result = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!result) return '';
  for (const [pattern, replacement] of ROMAN_TO_KATAKANA) {
    result = result.replace(pattern, replacement);
  }
  return result || word.toUpperCase();
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

async function loadCustomReadings(words: string[]): Promise<Record<string, string>> {
  const admin = createAdminClient();
  if (!admin || words.length === 0) return {};

  const keys = words.map(normalizeWord).filter(Boolean);
  if (keys.length === 0) return {};

  const { data, error } = await admin
    .from('custom_word_readings')
    .select('word_key, reading_katakana')
    .in('word_key', keys);

  if (error || !data) return {};

  const customMap: Record<string, string> = {};
  for (const row of data) {
    if (!row.word_key || !row.reading_katakana) continue;
    customMap[row.word_key] = row.reading_katakana;
  }
  return customMap;
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
    const body = (await req.json()) as { words?: unknown };
    const rawWords = Array.isArray(body.words) ? body.words : [];
    const words = rawWords.filter((w): w is string => typeof w === 'string').slice(0, 128);
    const customMap = await loadCustomReadings(words);

    const results = words.map((word) => {
      const normalized = normalizeWord(word);
      if (!normalized) return { word, katakana: '', source: 'ignored' as const };

      const customHit = customMap[normalized];
      if (customHit) {
        return { word, katakana: customHit, source: 'custom' as const };
      }

      const dictionaryHit = DICTIONARY[normalized];
      if (dictionaryHit) {
        return { word, katakana: dictionaryHit, source: 'dictionary' as const };
      }

      return { word, katakana: heuristicKatakana(word), source: 'heuristic' as const };
    });

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? 'Unknown error' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

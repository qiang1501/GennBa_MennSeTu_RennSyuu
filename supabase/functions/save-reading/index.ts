// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizeWord(word: string): string {
  return word
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_'’`".,\\/]+/g, '');
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function parseAllowedEmails(): string[] {
  const raw = Deno.env.get('ALLOWED_READING_EDITOR_EMAILS') ?? 'hongqiang365@gmail.com';
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function getRequestUserEmail(accessToken: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  return data.user.email.toLowerCase();
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
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const userEmail = await getRequestUserEmail(token);
    const allowedEmails = parseAllowedEmails();
    if (!userEmail || !allowedEmails.includes(userEmail)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as { word?: unknown; reading?: unknown };
    const word = typeof body.word === 'string' ? body.word.trim() : '';
    const reading = typeof body.reading === 'string' ? body.reading.trim() : '';
    const wordKey = normalizeWord(word);

    if (!wordKey) {
      return new Response(JSON.stringify({ error: 'word is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!reading) {
      return new Response(JSON.stringify({ error: 'reading is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const admin = createAdminClient();
    if (!admin) {
      return new Response(JSON.stringify({ error: 'Supabase admin client is not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await admin
      .from('custom_word_readings')
      .upsert(
        {
          word_key: wordKey,
          word,
          reading_katakana: reading,
        },
        { onConflict: 'word_key' },
      )
      .select('word_key, word, reading_katakana')
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ result: data }), {
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

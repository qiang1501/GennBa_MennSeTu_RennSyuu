import { createClient } from '@supabase/supabase-js';

function deriveSupabaseUrlFromFunctionUrl(functionUrl?: string): string | null {
  if (!functionUrl) return null;
  const match = functionUrl.match(/^(https:\/\/[^/]+)\//);
  return match ? match[1] : null;
}

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  ?? deriveSupabaseUrlFromFunctionUrl(import.meta.env.VITE_SUPABASE_TRANSLITERATE_URL as string | undefined);

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
    : null;

export const isSupabaseAuthConfigured = Boolean(supabaseClient);

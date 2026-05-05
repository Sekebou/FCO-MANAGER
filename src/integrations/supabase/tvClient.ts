// Isolated Supabase client for the public /tv page.
// Uses a distinct storageKey so signing in on /tv does NOT replace
// the session of the official app (and vice-versa).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseTv = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    storageKey: 'sb-fco-tv-auth',
    persistSession: true,
    autoRefreshToken: true,
  },
});

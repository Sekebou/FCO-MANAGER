
-- Move session_token to a separate secure table
-- so profiles can remain publicly readable without exposing tokens

CREATE TABLE IF NOT EXISTS public.user_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Only the owner can read/write their own session
CREATE POLICY "Users manage own session"
ON public.user_sessions FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Migrate existing session_token data
INSERT INTO public.user_sessions (user_id, session_token)
SELECT id, session_token FROM public.profiles
WHERE session_token IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET session_token = EXCLUDED.session_token;

-- Remove session_token from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS session_token;

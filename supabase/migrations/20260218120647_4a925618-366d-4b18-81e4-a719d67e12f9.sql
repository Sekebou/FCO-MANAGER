
-- Table to store FCM push notification tokens
CREATE TABLE public.fcm_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Users can insert/update their own token
CREATE POLICY "Users can manage their own FCM token"
ON public.fcm_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Anyone can read tokens (needed for sending notifications)
CREATE POLICY "Tokens are readable"
ON public.fcm_tokens
FOR SELECT
USING (true);


-- Add multi-use support to invitations
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS max_uses integer DEFAULT 1;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS use_count integer DEFAULT 0;

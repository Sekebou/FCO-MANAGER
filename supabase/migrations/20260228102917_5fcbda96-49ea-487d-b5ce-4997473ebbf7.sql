
-- Add cache columns to championships table
ALTER TABLE public.championships 
  ADD COLUMN IF NOT EXISTS fff_live_cache jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fff_refreshed_at timestamp with time zone DEFAULT NULL;

-- fff_live_cache will store: { classement: [...], logos: {...}, upcoming: [...], results: [...] }

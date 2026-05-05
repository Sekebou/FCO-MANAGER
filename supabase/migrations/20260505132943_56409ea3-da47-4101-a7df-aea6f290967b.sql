ALTER TABLE public.tv_channels
  ADD COLUMN IF NOT EXISTS home_team text,
  ADD COLUMN IF NOT EXISTS away_team text,
  ADD COLUMN IF NOT EXISTS home_logo text,
  ADD COLUMN IF NOT EXISTS away_logo text,
  ADD COLUMN IF NOT EXISTS match_date text;
-- Table des chaînes TV (streams)
CREATE TABLE public.tv_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Autre',
  source_type TEXT NOT NULL DEFAULT 'm3u8', -- 'm3u8' ou 'iframe'
  url TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tv_channels ENABLE ROW LEVEL SECURITY;

-- Tous les membres connectés peuvent voir les chaînes actives
CREATE POLICY "Authenticated can view active channels"
ON public.tv_channels FOR SELECT
TO authenticated
USING (is_active = true OR is_admin(auth.uid()));

-- Seuls les admins peuvent gérer les chaînes
CREATE POLICY "Admins can insert channels"
ON public.tv_channels FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update channels"
ON public.tv_channels FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete channels"
ON public.tv_channels FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Favoris par utilisateur
CREATE TABLE public.tv_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.tv_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE public.tv_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own TV favorites"
ON public.tv_favorites FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX idx_tv_channels_category ON public.tv_channels(category, sort_order);
CREATE INDEX idx_tv_favorites_user ON public.tv_favorites(user_id);
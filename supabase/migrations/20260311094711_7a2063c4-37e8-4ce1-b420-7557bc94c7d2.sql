
CREATE TABLE public.match_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text,
  title text NOT NULL,
  date text NOT NULL,
  time text,
  location text,
  team text,
  home_team text,
  away_team text,
  home_logo text,
  away_logo text,
  home_score integer,
  away_score integer,
  convocations jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.match_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match sheets viewable by authenticated" ON public.match_sheets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert match sheets" ON public.match_sheets FOR INSERT TO authenticated WITH CHECK (can_manage(auth.uid()));
CREATE POLICY "Managers can update match sheets" ON public.match_sheets FOR UPDATE TO authenticated USING (can_manage(auth.uid()));
CREATE POLICY "Managers can delete match sheets" ON public.match_sheets FOR DELETE TO authenticated USING (can_manage(auth.uid()));

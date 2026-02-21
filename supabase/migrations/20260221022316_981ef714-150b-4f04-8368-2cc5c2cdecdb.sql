
-- Table: user_points (solde de monnaie virtuelle par utilisateur)
CREATE TABLE public.user_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  balance integer NOT NULL DEFAULT 100,
  total_won integer NOT NULL DEFAULT 0,
  total_bet integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: bets (paris sur les matchs)
CREATE TABLE public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  match_date text NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  prediction text NOT NULL,
  odds numeric NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payout integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

-- Table: points_transactions (historique des mouvements de points)
CREATE TABLE public.points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'bet',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;

-- user_points policies: everyone can see all balances, users can only modify their own
CREATE POLICY "User points viewable by authenticated"
  ON public.user_points FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own points"
  ON public.user_points FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own points"
  ON public.user_points FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- bets policies: all authenticated can see all bets, users insert their own, admins can update (settle)
CREATE POLICY "Bets viewable by authenticated"
  ON public.bets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own bets"
  ON public.bets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update bets"
  ON public.bets FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

-- points_transactions policies: users see their own, can insert their own
CREATE POLICY "Users can view own transactions"
  ON public.points_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.points_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for bets (live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_points;

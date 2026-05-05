-- 1. Add fixture and lineup cache to tv_channels
ALTER TABLE public.tv_channels
  ADD COLUMN IF NOT EXISTS api_fixture_id text,
  ADD COLUMN IF NOT EXISTS lineup_cache jsonb,
  ADD COLUMN IF NOT EXISTS lineup_refreshed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bets_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bets_settled boolean NOT NULL DEFAULT false;

-- 2. tv_bets table
CREATE TABLE IF NOT EXISTS public.tv_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.tv_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  bet_type text NOT NULL CHECK (bet_type IN ('match','exact_score','scorer')),
  prediction text,                 -- 'home' | 'draw' | 'away' for match
  predicted_score_home integer,
  predicted_score_away integer,
  scorer_name text,
  odds numeric NOT NULL,
  amount integer NOT NULL CHECK (amount BETWEEN 1 AND 500),
  payout integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

CREATE INDEX IF NOT EXISTS tv_bets_channel_idx ON public.tv_bets(channel_id);
CREATE INDEX IF NOT EXISTS tv_bets_user_idx ON public.tv_bets(user_id);

ALTER TABLE public.tv_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TV bets viewable by authenticated" ON public.tv_bets;
CREATE POLICY "TV bets viewable by authenticated"
  ON public.tv_bets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users insert own tv bets" ON public.tv_bets;
CREATE POLICY "Users insert own tv bets"
  ON public.tv_bets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update tv bets" ON public.tv_bets;
CREATE POLICY "Admins update tv bets"
  ON public.tv_bets FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- 3. RPC: place_tv_bet (charges user_points balance)
CREATE OR REPLACE FUNCTION public.place_tv_bet(
  p_channel_id uuid,
  p_bet_type text,
  p_prediction text,
  p_predicted_score_home integer,
  p_predicted_score_away integer,
  p_scorer_name text,
  p_amount integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_balance integer;
  v_odds numeric;
  v_existing uuid;
  v_channel RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount < 1 OR p_amount > 500 THEN RAISE EXCEPTION 'Mise invalide (1-500)'; END IF;
  IF p_bet_type NOT IN ('match','exact_score','scorer') THEN RAISE EXCEPTION 'Type invalide'; END IF;

  SELECT * INTO v_channel FROM tv_channels WHERE id = p_channel_id;
  IF v_channel IS NULL THEN RAISE EXCEPTION 'Chaîne introuvable'; END IF;
  IF v_channel.bets_open IS NOT TRUE THEN RAISE EXCEPTION 'Paris fermés sur ce match'; END IF;
  IF v_channel.bets_settled IS TRUE THEN RAISE EXCEPTION 'Paris déjà réglés'; END IF;

  -- Determine fixed odds
  IF p_bet_type = 'match' THEN
    IF p_prediction NOT IN ('home','draw','away') THEN RAISE EXCEPTION 'Pronostic invalide'; END IF;
    v_odds := CASE p_prediction WHEN 'home' THEN 2.0 WHEN 'draw' THEN 3.0 WHEN 'away' THEN 2.5 END;
  ELSIF p_bet_type = 'exact_score' THEN
    IF p_predicted_score_home IS NULL OR p_predicted_score_away IS NULL THEN RAISE EXCEPTION 'Score requis'; END IF;
    v_odds := 8.0;
  ELSE
    IF p_scorer_name IS NULL OR p_scorer_name = '' THEN RAISE EXCEPTION 'Buteur requis'; END IF;
    v_odds := 5.0;
  END IF;

  -- Prevent duplicate active bet of same kind
  IF p_bet_type = 'match' THEN
    SELECT id INTO v_existing FROM tv_bets WHERE user_id=v_user AND channel_id=p_channel_id AND bet_type='match' AND status='pending';
  ELSIF p_bet_type = 'exact_score' THEN
    SELECT id INTO v_existing FROM tv_bets WHERE user_id=v_user AND channel_id=p_channel_id AND bet_type='exact_score' AND status='pending';
  ELSE
    SELECT id INTO v_existing FROM tv_bets
      WHERE user_id=v_user AND channel_id=p_channel_id AND bet_type='scorer' AND status='pending'
        AND LOWER(scorer_name)=LOWER(p_scorer_name);
  END IF;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'Tu as déjà ce pari'; END IF;

  SELECT name INTO v_name FROM profiles WHERE id = v_user;
  v_name := COALESCE(v_name, 'Anonyme');

  -- Lock balance
  SELECT balance INTO v_balance FROM user_points WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN
    INSERT INTO user_points(user_id, balance, total_bet) VALUES (v_user, 100 - p_amount, p_amount);
    v_balance := 100;
  ELSIF v_balance < p_amount THEN
    RAISE EXCEPTION 'Solde insuffisant';
  ELSE
    UPDATE user_points SET balance = balance - p_amount, total_bet = total_bet + p_amount, updated_at = now() WHERE user_id = v_user;
  END IF;

  INSERT INTO tv_bets(channel_id, user_id, user_name, bet_type, prediction,
    predicted_score_home, predicted_score_away, scorer_name, odds, amount)
  VALUES (p_channel_id, v_user, v_name, p_bet_type, p_prediction,
    p_predicted_score_home, p_predicted_score_away, p_scorer_name, v_odds, p_amount);

  INSERT INTO points_transactions(user_id, amount, type, description)
  VALUES (v_user, -p_amount, 'bet',
    'Pari TV (' || p_bet_type || ') — ' || COALESCE(v_channel.home_team,'?') || ' vs ' || COALESCE(v_channel.away_team,'?'));

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - p_amount, 'odds', v_odds);
END;
$$;

-- 4. RPC: settle_tv_bets (admin only) — score + scorers
CREATE OR REPLACE FUNCTION public.settle_tv_bets(
  p_channel_id uuid,
  p_home_score integer,
  p_away_score integer,
  p_scorer_names text[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet RECORD;
  v_result text;
  v_won boolean;
  v_payout integer;
  v_count integer := 0;
  v_scorers_lower text[];
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF p_home_score IS NULL OR p_away_score IS NULL THEN RAISE EXCEPTION 'Score requis'; END IF;

  IF p_home_score > p_away_score THEN v_result := 'home';
  ELSIF p_home_score < p_away_score THEN v_result := 'away';
  ELSE v_result := 'draw'; END IF;

  v_scorers_lower := ARRAY(SELECT LOWER(TRIM(s)) FROM unnest(COALESCE(p_scorer_names,'{}'::text[])) s WHERE s IS NOT NULL AND TRIM(s) <> '');

  FOR v_bet IN SELECT * FROM tv_bets WHERE channel_id = p_channel_id AND status = 'pending' LOOP
    v_won := false;
    IF v_bet.bet_type = 'match' THEN
      v_won := (v_bet.prediction = v_result);
    ELSIF v_bet.bet_type = 'exact_score' THEN
      v_won := (v_bet.predicted_score_home = p_home_score AND v_bet.predicted_score_away = p_away_score);
    ELSE
      v_won := LOWER(TRIM(v_bet.scorer_name)) = ANY(v_scorers_lower);
    END IF;

    IF v_won THEN
      v_payout := CEIL(v_bet.amount::numeric * v_bet.odds);
      UPDATE tv_bets SET status='won', payout=v_payout, settled_at=now() WHERE id=v_bet.id;
      UPDATE user_points SET balance = balance + v_payout, total_won = total_won + v_payout, updated_at = now()
        WHERE user_id = v_bet.user_id;
      INSERT INTO points_transactions(user_id, amount, type, description)
      VALUES (v_bet.user_id, v_payout, 'win', 'Gain TV (' || v_bet.bet_type || ')');
    ELSE
      UPDATE tv_bets SET status='lost', payout=0, settled_at=now() WHERE id=v_bet.id;
      INSERT INTO points_transactions(user_id, amount, type, description)
      VALUES (v_bet.user_id, 0, 'loss', 'Pari TV perdu (' || v_bet.bet_type || ')');
    END IF;
    v_count := v_count + 1;
  END LOOP;

  UPDATE tv_channels SET bets_settled = true, bets_open = false WHERE id = p_channel_id;
  RETURN jsonb_build_object('settled', v_count, 'result', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_tv_bet(uuid,text,text,integer,integer,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_tv_bets(uuid,integer,integer,text[]) TO authenticated;
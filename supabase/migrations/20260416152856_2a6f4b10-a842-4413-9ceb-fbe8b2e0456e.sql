
-- Add new columns to bets table for scorer and exact score bets
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS bet_type text NOT NULL DEFAULT 'match',
  ADD COLUMN IF NOT EXISTS scorer_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scorer_player_name text,
  ADD COLUMN IF NOT EXISTS predicted_score_home integer,
  ADD COLUMN IF NOT EXISTS predicted_score_away integer;

-- Drop old place_bet function and recreate with new params
DROP FUNCTION IF EXISTS public.place_bet(uuid, text, text, text, text, text, numeric, integer, text);

CREATE OR REPLACE FUNCTION public.place_bet(
  p_user_id uuid,
  p_user_name text,
  p_match_date text,
  p_home_team text,
  p_away_team text,
  p_prediction text,
  p_odds numeric,
  p_amount integer,
  p_team text DEFAULT NULL,
  p_bet_type text DEFAULT 'match',
  p_scorer_player_id uuid DEFAULT NULL,
  p_scorer_player_name text DEFAULT NULL,
  p_predicted_score_home integer DEFAULT NULL,
  p_predicted_score_away integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance integer;
  v_existing_bet uuid;
  v_total_bet integer;
  v_normalized_date text;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_team IS NULL OR p_team = '' THEN
    RAISE EXCEPTION 'Mets à jour ton application pour parier';
  END IF;

  IF p_amount < 1 OR p_amount > 500 THEN
    RAISE EXCEPTION 'Mise invalide (1-500)';
  END IF;

  IF p_bet_type NOT IN ('match', 'scorer', 'exact_score') THEN
    RAISE EXCEPTION 'Type de pari invalide';
  END IF;

  IF p_bet_type = 'match' AND p_prediction NOT IN ('home', 'draw', 'away') THEN
    RAISE EXCEPTION 'Pronostic invalide';
  END IF;

  IF p_bet_type = 'scorer' AND p_scorer_player_id IS NULL THEN
    RAISE EXCEPTION 'Sélectionne un buteur';
  END IF;

  IF p_bet_type = 'exact_score' AND (p_predicted_score_home IS NULL OR p_predicted_score_away IS NULL) THEN
    RAISE EXCEPTION 'Entre un score exact';
  END IF;

  v_normalized_date := LEFT(p_match_date, 10);

  -- Check for existing bet of same type on same match
  IF p_bet_type = 'match' THEN
    SELECT id INTO v_existing_bet
    FROM bets
    WHERE user_id = p_user_id
      AND LEFT(match_date, 10) = v_normalized_date
      AND (
        (home_team = p_home_team AND away_team = p_away_team)
        OR (UPPER(home_team) = UPPER(p_home_team) AND UPPER(away_team) = UPPER(p_away_team))
      )
      AND team = p_team
      AND bet_type = 'match';
  ELSIF p_bet_type = 'scorer' THEN
    SELECT id INTO v_existing_bet
    FROM bets
    WHERE user_id = p_user_id
      AND LEFT(match_date, 10) = v_normalized_date
      AND (
        (home_team = p_home_team AND away_team = p_away_team)
        OR (UPPER(home_team) = UPPER(p_home_team) AND UPPER(away_team) = UPPER(p_away_team))
      )
      AND team = p_team
      AND bet_type = 'scorer'
      AND scorer_player_id = p_scorer_player_id;
  ELSIF p_bet_type = 'exact_score' THEN
    SELECT id INTO v_existing_bet
    FROM bets
    WHERE user_id = p_user_id
      AND LEFT(match_date, 10) = v_normalized_date
      AND (
        (home_team = p_home_team AND away_team = p_away_team)
        OR (UPPER(home_team) = UPPER(p_home_team) AND UPPER(away_team) = UPPER(p_away_team))
      )
      AND team = p_team
      AND bet_type = 'exact_score';
  END IF;

  IF v_existing_bet IS NOT NULL THEN
    RAISE EXCEPTION 'Tu as déjà ce pari sur ce match';
  END IF;

  SELECT balance, total_bet INTO v_balance, v_total_bet
  FROM user_points
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO user_points (user_id, balance, total_bet)
    VALUES (p_user_id, 100 - p_amount, p_amount);
    v_balance := 100;
  ELSIF v_balance < p_amount THEN
    RAISE EXCEPTION 'Solde insuffisant';
  ELSE
    UPDATE user_points
    SET balance = balance - p_amount,
        total_bet = total_bet + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO bets (
    user_id, user_name, match_date, home_team, away_team,
    prediction, odds, amount, team, bet_type,
    scorer_player_id, scorer_player_name,
    predicted_score_home, predicted_score_away
  ) VALUES (
    p_user_id, p_user_name, p_match_date, p_home_team, p_away_team,
    p_prediction, p_odds, p_amount, p_team, p_bet_type,
    p_scorer_player_id, p_scorer_player_name,
    p_predicted_score_home, p_predicted_score_away
  );

  INSERT INTO points_transactions (user_id, amount, type, description)
  VALUES (
    p_user_id,
    -p_amount,
    'bet',
    CASE p_bet_type
      WHEN 'scorer' THEN format('Pari buteur: %s — %s vs %s', COALESCE(p_scorer_player_name, '?'), p_home_team, p_away_team)
      WHEN 'exact_score' THEN format('Pari score: %s-%s — %s vs %s', p_predicted_score_home, p_predicted_score_away, p_home_team, p_away_team)
      ELSE format('Pari: %s vs %s — %s (cote %s)', p_home_team, p_away_team, p_prediction, p_odds)
    END
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - p_amount);
END;
$$;

-- Update settle_match_bets to also settle exact_score bets
DROP FUNCTION IF EXISTS public.settle_match_bets(text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.settle_match_bets(
  p_home_team text,
  p_away_team text,
  p_match_date text,
  p_home_score integer,
  p_away_score integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result text;
  v_bet RECORD;
  v_settled integer := 0;
  v_is_won boolean;
BEGIN
  IF NOT has_role(auth.uid(), 'admin_plus') THEN
    RAISE EXCEPTION 'Accès refusé : seul Admin+ peut régler les paris';
  END IF;

  IF p_home_score > p_away_score THEN
    v_result := 'home';
  ELSIF p_home_score < p_away_score THEN
    v_result := 'away';
  ELSE
    v_result := 'draw';
  END IF;

  FOR v_bet IN
    SELECT id, user_id, prediction, odds, amount, bet_type, predicted_score_home, predicted_score_away
    FROM bets
    WHERE home_team = p_home_team
      AND away_team = p_away_team
      AND match_date = p_match_date
      AND status = 'pending'
      AND bet_type IN ('match', 'exact_score')
  LOOP
    v_is_won := false;

    IF v_bet.bet_type = 'match' THEN
      v_is_won := (v_bet.prediction = v_result);
    ELSIF v_bet.bet_type = 'exact_score' THEN
      v_is_won := (v_bet.predicted_score_home = p_home_score AND v_bet.predicted_score_away = p_away_score);
    END IF;

    IF v_is_won THEN
      UPDATE bets
      SET status = 'won',
          payout = CEIL(v_bet.amount::numeric * v_bet.odds),
          settled_at = now()
      WHERE id = v_bet.id;

      UPDATE user_points
      SET balance = balance + CEIL(v_bet.amount::numeric * v_bet.odds),
          total_won = total_won + CEIL(v_bet.amount::numeric * v_bet.odds),
          updated_at = now()
      WHERE user_id = v_bet.user_id;

      INSERT INTO points_transactions (user_id, amount, type, description)
      VALUES (
        v_bet.user_id,
        CEIL(v_bet.amount::numeric * v_bet.odds),
        'win',
        format('Gain: %s vs %s — %s-%s', p_home_team, p_away_team, p_home_score, p_away_score)
      );
    ELSE
      UPDATE bets
      SET status = 'lost',
          payout = 0,
          settled_at = now()
      WHERE id = v_bet.id;

      INSERT INTO points_transactions (user_id, amount, type, description)
      VALUES (
        v_bet.user_id,
        0,
        'loss',
        format('Perdu: %s vs %s — %s-%s', p_home_team, p_away_team, p_home_score, p_away_score)
      );
    END IF;

    v_settled := v_settled + 1;
  END LOOP;

  RETURN jsonb_build_object('settled', v_settled, 'result', v_result);
END;
$$;

-- New function: settle scorer bets manually
CREATE OR REPLACE FUNCTION public.settle_scorer_bets(
  p_home_team text,
  p_away_team text,
  p_match_date text,
  p_scorer_player_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bet RECORD;
  v_settled integer := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin_plus') THEN
    RAISE EXCEPTION 'Accès refusé : seul Admin+ peut régler les paris';
  END IF;

  FOR v_bet IN
    SELECT id, user_id, scorer_player_id, odds, amount
    FROM bets
    WHERE home_team = p_home_team
      AND away_team = p_away_team
      AND match_date = p_match_date
      AND status = 'pending'
      AND bet_type = 'scorer'
  LOOP
    IF v_bet.scorer_player_id = ANY(p_scorer_player_ids) THEN
      UPDATE bets
      SET status = 'won',
          payout = CEIL(v_bet.amount::numeric * v_bet.odds),
          settled_at = now()
      WHERE id = v_bet.id;

      UPDATE user_points
      SET balance = balance + CEIL(v_bet.amount::numeric * v_bet.odds),
          total_won = total_won + CEIL(v_bet.amount::numeric * v_bet.odds),
          updated_at = now()
      WHERE user_id = v_bet.user_id;

      INSERT INTO points_transactions (user_id, amount, type, description)
      VALUES (
        v_bet.user_id,
        CEIL(v_bet.amount::numeric * v_bet.odds),
        'win',
        format('Gain buteur: %s vs %s', p_home_team, p_away_team)
      );
    ELSE
      UPDATE bets
      SET status = 'lost',
          payout = 0,
          settled_at = now()
      WHERE id = v_bet.id;

      INSERT INTO points_transactions (user_id, amount, type, description)
      VALUES (
        v_bet.user_id,
        0,
        'loss',
        format('Perdu buteur: %s vs %s', p_home_team, p_away_team)
      );
    END IF;

    v_settled := v_settled + 1;
  END LOOP;

  RETURN jsonb_build_object('settled', v_settled);
END;
$$;

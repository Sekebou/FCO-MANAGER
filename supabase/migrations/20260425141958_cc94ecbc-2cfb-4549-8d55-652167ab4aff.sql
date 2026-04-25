CREATE OR REPLACE FUNCTION public.place_bet(p_user_id uuid, p_user_name text, p_match_date text, p_home_team text, p_away_team text, p_prediction text, p_odds numeric, p_amount integer, p_team text DEFAULT NULL::text, p_bet_type text DEFAULT 'match'::text, p_scorer_player_id uuid DEFAULT NULL::uuid, p_scorer_player_name text DEFAULT NULL::text, p_predicted_score_home integer DEFAULT NULL::integer, p_predicted_score_away integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance integer;
  v_existing_bet uuid;
  v_total_bet integer;
  v_normalized_date text;
  v_event_record RECORD;
  v_kickoff_ts timestamptz;
  v_now timestamptz := now();
  v_lock_buffer interval := interval '5 minutes';
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

  SELECT date, time INTO v_event_record
  FROM events
  WHERE type = 'match'
    AND team = p_team
    AND LEFT(date, 10) = v_normalized_date
  LIMIT 1;

  IF v_event_record.date IS NOT NULL THEN
    BEGIN
      IF v_event_record.time IS NOT NULL AND v_event_record.time <> '' THEN
        v_kickoff_ts := (
          v_normalized_date || ' ' ||
          REPLACE(v_event_record.time, 'H', ':') || ':00'
        )::timestamptz;
      ELSE
        v_kickoff_ts := (v_normalized_date || ' 05:00:00')::timestamptz;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_kickoff_ts := (v_normalized_date || ' 05:00:00')::timestamptz;
    END;
  ELSE
    BEGIN
      v_kickoff_ts := (v_normalized_date || ' 05:00:00')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_kickoff_ts := NULL;
    END;
  END IF;

  IF v_kickoff_ts IS NOT NULL AND v_now > (v_kickoff_ts + v_lock_buffer) THEN
    RAISE EXCEPTION 'Paris fermés : le match a déjà commencé';
  END IF;

  -- Check for existing ACTIVE bet of same type on same match (ignore refunded/cancelled)
  IF p_bet_type = 'match' THEN
    SELECT id INTO v_existing_bet
    FROM bets
    WHERE user_id = p_user_id
      AND status = 'pending'
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
      AND status = 'pending'
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
      AND status = 'pending'
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
$function$;
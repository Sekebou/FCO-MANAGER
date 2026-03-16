
CREATE OR REPLACE FUNCTION public.place_bet(p_user_id uuid, p_user_name text, p_match_date text, p_home_team text, p_away_team text, p_prediction text, p_odds numeric, p_amount integer)
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
BEGIN
  -- Validate caller matches p_user_id
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate amount
  IF p_amount < 1 OR p_amount > 500 THEN
    RAISE EXCEPTION 'Mise invalide (1-500)';
  END IF;

  -- Validate prediction
  IF p_prediction NOT IN ('home', 'draw', 'away') THEN
    RAISE EXCEPTION 'Pronostic invalide';
  END IF;

  -- Normalize date to YYYY-MM-DD for comparison
  v_normalized_date := LEFT(p_match_date, 10);

  -- Check for existing bet on same match (using normalized date and fuzzy team match)
  SELECT id INTO v_existing_bet
  FROM bets
  WHERE user_id = p_user_id
    AND LEFT(match_date, 10) = v_normalized_date
    AND (
      (home_team = p_home_team AND away_team = p_away_team)
      OR (UPPER(home_team) = UPPER(p_home_team) AND UPPER(away_team) = UPPER(p_away_team))
    );

  IF v_existing_bet IS NOT NULL THEN
    RAISE EXCEPTION 'Tu as déjà parié sur ce match';
  END IF;

  -- Get current balance (lock row)
  SELECT balance, total_bet INTO v_balance, v_total_bet
  FROM user_points
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    -- Create initial balance
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

  -- Insert bet
  INSERT INTO bets (
    user_id, user_name, match_date, home_team, away_team,
    prediction, odds, amount
  ) VALUES (
    p_user_id, p_user_name, p_match_date, p_home_team, p_away_team,
    p_prediction, p_odds, p_amount
  );

  -- Log transaction
  INSERT INTO points_transactions (user_id, amount, type, description)
  VALUES (
    p_user_id,
    -p_amount,
    'bet',
    format('Pari: %s vs %s — %s (cote %s)', p_home_team, p_away_team, p_prediction, p_odds)
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - p_amount);
END;
$function$;

CREATE OR REPLACE FUNCTION public.place_tv_bet(p_channel_id uuid, p_bet_type text, p_prediction text, p_predicted_score_home integer, p_predicted_score_away integer, p_scorer_name text, p_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_balance integer;
  v_odds numeric;
  v_existing uuid;
  v_channel RECORD;
  v_kickoff timestamptz;
  v_now timestamptz := now();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF p_amount < 1 OR p_amount > 500 THEN RAISE EXCEPTION 'Mise invalide (1-500)'; END IF;
  IF p_bet_type NOT IN ('match','exact_score','scorer') THEN RAISE EXCEPTION 'Type invalide'; END IF;

  SELECT * INTO v_channel FROM tv_channels WHERE id = p_channel_id;
  IF v_channel IS NULL THEN RAISE EXCEPTION 'Chaîne introuvable'; END IF;
  IF v_channel.bets_open IS NOT TRUE THEN RAISE EXCEPTION 'Paris fermés sur ce match'; END IF;
  IF v_channel.bets_settled IS TRUE THEN RAISE EXCEPTION 'Paris déjà réglés'; END IF;

  -- Time-based lock: 20 minutes after kickoff
  IF v_channel.match_date IS NOT NULL AND v_channel.match_time IS NOT NULL AND v_channel.match_time <> '' THEN
    BEGIN
      v_kickoff := (left(v_channel.match_date, 10) || ' ' ||
        CASE WHEN length(v_channel.match_time) = 5 THEN v_channel.match_time || ':00' ELSE v_channel.match_time END
      )::timestamptz;
      IF v_now > v_kickoff + interval '20 minutes' THEN
        RAISE EXCEPTION 'Trop tard : les paris se ferment 20 min après le coup d''envoi';
      END IF;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
      NULL;
    END;
  END IF;

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
$function$;
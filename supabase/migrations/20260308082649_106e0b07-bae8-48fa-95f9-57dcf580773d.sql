
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
BEGIN
  -- Determine match result
  IF p_home_score > p_away_score THEN
    v_result := 'home';
  ELSIF p_home_score < p_away_score THEN
    v_result := 'away';
  ELSE
    v_result := 'draw';
  END IF;

  -- Process all pending bets for this match
  FOR v_bet IN
    SELECT id, user_id, prediction, odds, amount
    FROM bets
    WHERE home_team = p_home_team
      AND away_team = p_away_team
      AND match_date = p_match_date
      AND status = 'pending'
  LOOP
    IF v_bet.prediction = v_result THEN
      -- Winner: credit payout
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
      -- Loser
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

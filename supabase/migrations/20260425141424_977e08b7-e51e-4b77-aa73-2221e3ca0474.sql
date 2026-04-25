CREATE OR REPLACE FUNCTION public.refund_scorer_bets_for_player(
  p_home_team text,
  p_away_team text,
  p_match_date text,
  p_scorer_player_id uuid,
  p_reason text DEFAULT 'Joueur retiré de la feuille de match'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet RECORD;
  v_count integer := 0;
  v_day text := substring(coalesce(p_match_date, '') from 1 for 10);
BEGIN
  -- Only managers (admin / admin_plus / entraineur) may trigger refunds
  IF NOT can_manage(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé : seuls les managers peuvent rembourser des paris';
  END IF;

  IF v_day IS NULL OR length(v_day) < 10 THEN
    RETURN jsonb_build_object('refunded', 0, 'error', 'invalid date');
  END IF;

  -- Match all pending scorer bets for this player on the same calendar day.
  -- We compare on the day prefix only because team names and date formats
  -- can diverge between the bets table and the match_sheets table
  -- (suffixes like " 2" / " B", or full ISO timestamps vs YYYY-MM-DD).
  FOR v_bet IN
    SELECT id, user_id, amount, scorer_player_name, home_team, away_team
    FROM bets
    WHERE bet_type = 'scorer'
      AND status = 'pending'
      AND scorer_player_id = p_scorer_player_id
      AND substring(coalesce(match_date, '') from 1 for 10) = v_day
  LOOP
    UPDATE bets
    SET status = 'refunded',
        payout = v_bet.amount,
        settled_at = now()
    WHERE id = v_bet.id;

    UPDATE user_points
    SET balance = balance + v_bet.amount,
        total_bet = GREATEST(0, total_bet - v_bet.amount),
        updated_at = now()
    WHERE user_id = v_bet.user_id;

    INSERT INTO points_transactions (user_id, amount, type, description)
    VALUES (
      v_bet.user_id,
      v_bet.amount,
      'refund',
      format('Remboursement (%s): %s vs %s — %s', p_reason, v_bet.home_team, v_bet.away_team, COALESCE(v_bet.scorer_player_name, 'Joueur'))
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('refunded', v_count);
END;
$$;
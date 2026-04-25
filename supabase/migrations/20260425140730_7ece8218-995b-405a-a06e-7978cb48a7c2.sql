-- Add tracking column for refund notifications
ALTER TABLE public.user_points
  ADD COLUMN IF NOT EXISTS last_refund_seen_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z';

-- RPC: refund all pending "scorer" bets on a given player for a given match
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
BEGIN
  -- Only managers (admin / admin_plus / entraineur) may trigger refunds
  IF NOT can_manage(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé : seuls les managers peuvent rembourser des paris';
  END IF;

  FOR v_bet IN
    SELECT id, user_id, amount, scorer_player_name
    FROM bets
    WHERE home_team = p_home_team
      AND away_team = p_away_team
      AND match_date = p_match_date
      AND bet_type = 'scorer'
      AND scorer_player_id = p_scorer_player_id
      AND status = 'pending'
  LOOP
    UPDATE bets
    SET status = 'refunded',
        payout = v_bet.amount,
        settled_at = now()
    WHERE id = v_bet.id;

    -- Refund the stake to the user's balance
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
      format('Remboursement (%s): %s vs %s — %s', p_reason, p_home_team, p_away_team, COALESCE(v_bet.scorer_player_name, 'Joueur'))
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('refunded', v_count);
END;
$$;
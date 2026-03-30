
-- Refund points to user balances for all pending bets
UPDATE user_points SET 
  balance = balance + sub.total_refund,
  total_bet = total_bet - sub.total_refund,
  updated_at = now()
FROM (
  SELECT user_id, SUM(amount) as total_refund 
  FROM bets WHERE status = 'pending' 
  GROUP BY user_id
) sub
WHERE user_points.user_id = sub.user_id;

-- Log refund transactions
INSERT INTO points_transactions (user_id, amount, type, description)
SELECT user_id, amount, 'refund', 
  format('Remboursement pari annulé: %s vs %s (%s)', home_team, away_team, COALESCE(team, '?'))
FROM bets WHERE status = 'pending';

-- Delete the pending bets
DELETE FROM bets WHERE status = 'pending';

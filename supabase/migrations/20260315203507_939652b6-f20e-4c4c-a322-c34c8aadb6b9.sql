
-- Settle the 2 pending bets manually: AMIENS MONTIERES CS vs OISEMONT FC, score 1-1 = draw
-- Both bets predicted 'away' so both lost

UPDATE bets 
SET status = 'lost', payout = 0, settled_at = now()
WHERE status = 'pending' 
  AND home_team = 'AMIENS MONTIERES CS' 
  AND away_team = 'OISEMONT FC'
  AND match_date = '2026-03-15T00:00:00+00:00';

-- Log loss transactions
INSERT INTO points_transactions (user_id, amount, type, description)
SELECT user_id, 0, 'loss', 'Perdu: AMIENS MONTIERES CS vs OISEMONT FC — 1-1'
FROM bets
WHERE home_team = 'AMIENS MONTIERES CS' 
  AND away_team = 'OISEMONT FC'
  AND match_date = '2026-03-15T00:00:00+00:00'
  AND status = 'lost'
  AND settled_at >= now() - interval '1 minute';

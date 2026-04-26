-- Correction du règlement du match OISEMONT FC 2 vs NIBAS FRESSENNEVILLE (2026-04-26)
-- Vrai résultat : 0-3 (victoire Fressenneville / "away"), réglé à tort comme victoire "home"

-- 1) Annuler le gain à tort de Jordan Tirard (pari "home" 45 @ 4.3 → payout 194)
UPDATE user_points
SET balance = balance - 194,
    total_won = GREATEST(0, total_won - 194),
    updated_at = now()
WHERE user_id = 'f75a1c5b-b2b6-4d93-83ac-a02bfd028486';

UPDATE bets
SET status = 'lost', payout = 0, settled_at = now()
WHERE id = '54e512ca-a77a-4472-87dd-55159fb31e73';

INSERT INTO points_transactions (user_id, amount, type, description)
VALUES (
  'f75a1c5b-b2b6-4d93-83ac-a02bfd028486',
  -194,
  'loss',
  'Correction règlement : OISEMONT FC 2 vs NIBAS FRESSENNEVILLE 0-3 (annulation gain à tort)'
);

-- 2) Créditer les paris "away" qui auraient dû gagner (cote 4.7)
-- Charly Cauche : 214 @ 4.7 → 1006
UPDATE bets SET status = 'won', payout = 1006, settled_at = now()
WHERE id = 'c769a2ba-9fec-442b-8770-e9052a61fb69';
UPDATE user_points SET balance = balance + 1006, total_won = total_won + 1006, updated_at = now()
WHERE user_id = 'a9279bc5-6ce5-455c-bd10-42e6aaa04f44';
INSERT INTO points_transactions (user_id, amount, type, description)
VALUES ('a9279bc5-6ce5-455c-bd10-42e6aaa04f44', 1006, 'win',
        'Correction gain : OISEMONT FC 2 vs NIBAS FRESSENNEVILLE 0-3');

-- Franck Durand : 100 @ 4.7 → 470
UPDATE bets SET status = 'won', payout = 470, settled_at = now()
WHERE id = 'c880815e-a5e5-4182-8fa3-9102aac0c886';
UPDATE user_points SET balance = balance + 470, total_won = total_won + 470, updated_at = now()
WHERE user_id = 'e93178e7-fb2e-430f-8545-f953d0837e66';
INSERT INTO points_transactions (user_id, amount, type, description)
VALUES ('e93178e7-fb2e-430f-8545-f953d0837e66', 470, 'win',
        'Correction gain : OISEMONT FC 2 vs NIBAS FRESSENNEVILLE 0-3');

-- Ludo Poiret : 60 @ 4.7 → 282
UPDATE bets SET status = 'won', payout = 282, settled_at = now()
WHERE id = 'f824546b-29f0-4226-92ec-189b391b924c';
UPDATE user_points SET balance = balance + 282, total_won = total_won + 282, updated_at = now()
WHERE user_id = '709e9024-aba0-485a-82f4-e763a9d8ace5';
INSERT INTO points_transactions (user_id, amount, type, description)
VALUES ('709e9024-aba0-485a-82f4-e763a9d8ace5', 282, 'win',
        'Correction gain : OISEMONT FC 2 vs NIBAS FRESSENNEVILLE 0-3');

-- Nathan Durand : 40 @ 4.7 → 188
UPDATE bets SET status = 'won', payout = 188, settled_at = now()
WHERE id = '9ac42dea-f104-4b70-9926-9f4eb6672ae8';
UPDATE user_points SET balance = balance + 188, total_won = total_won + 188, updated_at = now()
WHERE user_id = 'c7d788f5-d5fd-45ba-b7c6-474dd131b340';
INSERT INTO points_transactions (user_id, amount, type, description)
VALUES ('c7d788f5-d5fd-45ba-b7c6-474dd131b340', 188, 'win',
        'Correction gain : OISEMONT FC 2 vs NIBAS FRESSENNEVILLE 0-3');

-- Patrick Mazière : 31 @ 4.7 → 146
UPDATE bets SET status = 'won', payout = 146, settled_at = now()
WHERE id = 'cba5b9fa-b084-4812-9edd-8c11ec139911';
UPDATE user_points SET balance = balance + 146, total_won = total_won + 146, updated_at = now()
WHERE user_id = '727f2b3f-f27e-4f8d-9c27-cf592fd3a733';
INSERT INTO points_transactions (user_id, amount, type, description)
VALUES ('727f2b3f-f27e-4f8d-9c27-cf592fd3a733', 146, 'win',
        'Correction gain : OISEMONT FC 2 vs NIBAS FRESSENNEVILLE 0-3');

-- Thomas Lermechin : 50 @ 4.7 → 235
UPDATE bets SET status = 'won', payout = 235, settled_at = now()
WHERE id = 'bf32c66e-cbc9-49f5-b260-c99a26fae773';
UPDATE user_points SET balance = balance + 235, total_won = total_won + 235, updated_at = now()
WHERE user_id = '34c5d3fc-8d2b-4f3f-b526-0dda0dfaa57c';
INSERT INTO points_transactions (user_id, amount, type, description)
VALUES ('34c5d3fc-8d2b-4f3f-b526-0dda0dfaa57c', 235, 'win',
        'Correction gain : OISEMONT FC 2 vs NIBAS FRESSENNEVILLE 0-3');

-- 3) Mettre à jour la feuille de match avec le bon score
UPDATE match_sheets
SET home_score = 0, away_score = 3
WHERE id = '4c2afe40-0d74-4bb5-a639-dce57a234522';
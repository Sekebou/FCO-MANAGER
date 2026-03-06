
-- 1. Add UNIQUE constraint on fcm_tokens.token
ALTER TABLE public.fcm_tokens ADD CONSTRAINT fcm_tokens_token_unique UNIQUE (token);

-- 2. Add UNIQUE constraint on user_points.user_id to prevent duplicates
-- First deduplicate: keep only the row with the highest balance per user_id
DELETE FROM public.user_points
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.user_points
  ORDER BY user_id, updated_at DESC
);

ALTER TABLE public.user_points ADD CONSTRAINT user_points_user_id_unique UNIQUE (user_id);

-- 3. Clean up daily transactions (remove all 'daily' type)
DELETE FROM public.points_transactions WHERE type = 'daily';

-- 4. Clean up used invitations
DELETE FROM public.invitations WHERE status = 'used';

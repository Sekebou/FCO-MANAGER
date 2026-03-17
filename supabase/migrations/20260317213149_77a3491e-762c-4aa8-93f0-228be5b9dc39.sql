
-- Add unique constraint on user_id + platform to prevent future duplicates
-- First drop old unique constraint on token if exists
ALTER TABLE fcm_tokens DROP CONSTRAINT IF EXISTS fcm_tokens_token_key;

-- Add unique constraint per user per platform (one token per device type)
ALTER TABLE fcm_tokens ADD CONSTRAINT fcm_tokens_user_platform_unique UNIQUE (user_id, platform);

-- Add display_role column to profiles
-- When set, the UI shows this role label instead of the actual permission role
-- Permissions still use user_roles table
ALTER TABLE public.profiles ADD COLUMN display_role text DEFAULT NULL;

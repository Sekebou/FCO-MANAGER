-- Create ghost admin account via auth
-- We'll use a trigger approach: first create a temporary function that will be called after the user is created

-- Step 1: We'll need to create the user via the edge function
-- For now, let's prepare: ensure the profile gets marked as ghost once created
CREATE OR REPLACE FUNCTION public.mark_ghost_on_review_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email = 'review@fco-manager.fr' THEN
    NEW.is_ghost := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_ghost_review
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.mark_ghost_on_review_account();
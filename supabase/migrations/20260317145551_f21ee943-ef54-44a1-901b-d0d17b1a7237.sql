CREATE OR REPLACE FUNCTION public.increment_invite_use_count(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.invitations
  SET use_count = COALESCE(use_count, 0) + 1
  WHERE id = p_invitation_id;
END;
$$;
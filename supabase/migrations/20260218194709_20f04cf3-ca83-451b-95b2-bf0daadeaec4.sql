
-- SECURITY DEFINER function for self-registration (bypasses RLS)
CREATE OR REPLACE FUNCTION public.register_user(
  p_user_id uuid,
  p_email text,
  p_name text,
  p_role text,
  p_position text DEFAULT 'Attaquant',
  p_license_expiry text DEFAULT NULL,
  p_invitation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
BEGIN
  -- Create player if not photographe
  IF p_role <> 'photographe' THEN
    INSERT INTO public.players (name, position, matches, goals, assists, license_expiry)
    VALUES (p_name, COALESCE(p_position, 'Attaquant'), 0, 0, 0, p_license_expiry)
    RETURNING id INTO v_player_id;
  END IF;

  -- Create profile (trigger auto-creates user_role)
  INSERT INTO public.profiles (id, email, name, role, username, player_id)
  VALUES (p_user_id, p_email, p_name, p_role, split_part(p_email, '@', 1), v_player_id);

  -- Update invitation if provided
  IF p_invitation_id IS NOT NULL THEN
    UPDATE public.invitations
    SET status = 'used', used_at = now(), used_by = p_user_id
    WHERE id = p_invitation_id AND status = 'pending';
  END IF;

  RETURN jsonb_build_object('player_id', v_player_id);
END;
$$;

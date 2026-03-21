
-- 1. Fix HAM match sheet: replace deleted player a45c1fac with Jules Tellier (2cd712e3)
UPDATE match_sheets
SET convocations = (convocations - 'a45c1fac-203a-4d0d-9cf2-2de1ef6e80b2') || 
  jsonb_build_object('2cd712e3-baf3-44e8-8271-eca7ff1811ff', convocations->'a45c1fac-203a-4d0d-9cf2-2de1ef6e80b2')
WHERE id = '904ee510-6f0f-45dd-a6d8-7dc6fc666f0f'
  AND convocations ? 'a45c1fac-203a-4d0d-9cf2-2de1ef6e80b2';

-- 2. Fix duplicate Marc Antoine Pegard: keep old 60940c58, update profile to point to it
UPDATE profiles 
SET player_id = '60940c58-05fa-4e70-ad48-5dde9173d88f'
WHERE player_id = '6e378cc6-1c26-498a-aa17-19f5a27d9352';

-- 3. Fix duplicate Thibault Blondin: keep old 7d65c703, update profile to point to it
UPDATE profiles 
SET player_id = '7d65c703-5103-4df2-b0b6-1e941397dd7d',
    name = 'Thibault Blondin'
WHERE player_id = 'f83ba0e1-f739-416d-b10a-944aeefdafac';

-- 4. Merge presences in event 725e90c1: remove duplicate entries
UPDATE events
SET presences = presences - '6e378cc6-1c26-498a-aa17-19f5a27d9352' - 'f83ba0e1-f739-416d-b10a-944aeefdafac'
WHERE id = '725e90c1-5d29-4783-ac64-895ca34a4b2f';

-- 5. Delete the duplicate player entries
DELETE FROM players WHERE id IN ('6e378cc6-1c26-498a-aa17-19f5a27d9352', 'f83ba0e1-f739-416d-b10a-944aeefdafac');

-- 6. Fix capitalization
UPDATE players SET name = 'Thibault Blondin' WHERE id = '7d65c703-5103-4df2-b0b6-1e941397dd7d';

-- 7. Update register_user to check for existing players by name before creating duplicates
CREATE OR REPLACE FUNCTION public.register_user(
  p_user_id uuid, p_email text, p_name text, p_role text,
  p_position text DEFAULT 'Attaquant', p_license_expiry text DEFAULT NULL,
  p_invitation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_player_id uuid;
BEGIN
  IF p_role <> 'photographe' THEN
    SELECT id INTO v_player_id
    FROM public.players
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(p_name))
    LIMIT 1;

    IF v_player_id IS NULL THEN
      INSERT INTO public.players (name, position, matches, goals, assists, license_expiry)
      VALUES (p_name, COALESCE(p_position, 'Attaquant'), 0, 0, 0, p_license_expiry)
      RETURNING id INTO v_player_id;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, username, player_id)
  VALUES (p_user_id, p_email, p_name, p_role, split_part(p_email, '@', 1), v_player_id);

  IF p_invitation_id IS NOT NULL THEN
    UPDATE public.invitations
    SET use_count = COALESCE(use_count, 0) + 1,
        used_at = now(),
        used_by = p_user_id,
        status = CASE
          WHEN COALESCE(max_uses, 1) <= 1 THEN 'used'
          WHEN COALESCE(use_count, 0) + 1 >= COALESCE(max_uses, 1) THEN 'used'
          ELSE status
        END
    WHERE id = p_invitation_id;
  END IF;

  RETURN jsonb_build_object('player_id', v_player_id);
END;
$$;

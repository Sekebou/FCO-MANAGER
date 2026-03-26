CREATE OR REPLACE FUNCTION public.update_event_presence(p_event_id uuid, p_status text, p_absence_reason text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_player_id text;
BEGIN
  IF p_status NOT IN ('present', 'absent', 'incertain', '') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;

  SELECT player_id::text INTO v_player_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Aucun joueur associé';
  END IF;

  UPDATE events
  SET presences = jsonb_set(
    COALESCE(presences, '{}'::jsonb),
    ARRAY[v_player_id],
    to_jsonb(p_status),
    true
  ),
  absence_reasons = CASE
    WHEN p_status = 'absent' AND p_absence_reason IS NOT NULL AND p_absence_reason <> '' THEN
      jsonb_set(COALESCE(absence_reasons, '{}'::jsonb), ARRAY[v_player_id], to_jsonb(p_absence_reason), true)
    ELSE
      COALESCE(absence_reasons, '{}'::jsonb) - v_player_id
  END
  WHERE id = p_event_id;
END;
$$;
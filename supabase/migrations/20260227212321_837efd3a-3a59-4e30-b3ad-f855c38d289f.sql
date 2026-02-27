
-- Fix 1: Restrict events UPDATE policy to managers only
DROP POLICY IF EXISTS "Managers can update events" ON public.events;

CREATE POLICY "Managers can update events"
ON public.events FOR UPDATE TO authenticated
USING (can_manage(auth.uid()) OR has_role(auth.uid(), 'dirigeant'::app_role));

-- Allow players to update only their presence via a dedicated RPC
CREATE OR REPLACE FUNCTION public.update_event_presence(
  p_event_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id text;
BEGIN
  IF p_status NOT IN ('present', 'absent', 'incertain') THEN
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
  )
  WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_event_presence TO authenticated;

-- Fix 2: Update get_own_session_token to use user_sessions table
CREATE OR REPLACE FUNCTION public.get_own_session_token(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT session_token FROM user_sessions WHERE user_id = p_user_id AND p_user_id = auth.uid();
$$;

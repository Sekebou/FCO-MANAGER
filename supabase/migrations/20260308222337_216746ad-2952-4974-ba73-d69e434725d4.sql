
-- Drop overly permissive policy and replace with specific ones
DROP POLICY IF EXISTS "Authenticated can update photo likes" ON public.gallery_photos;

-- Allow photo managers (admin/photographe) to update any field
CREATE POLICY "Photo managers can update photos"
  ON public.gallery_photos FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'photographe'::app_role));

-- Allow any authenticated user to update only likes (via function)
CREATE OR REPLACE FUNCTION public.toggle_photo_like(p_photo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_likes uuid[];
BEGIN
  SELECT COALESCE(likes, '{}') INTO v_likes FROM gallery_photos WHERE id = p_photo_id;
  IF v_uid = ANY(v_likes) THEN
    UPDATE gallery_photos SET likes = array_remove(likes, v_uid) WHERE id = p_photo_id;
  ELSE
    UPDATE gallery_photos SET likes = array_append(COALESCE(likes, '{}'), v_uid) WHERE id = p_photo_id;
  END IF;
END;
$$;

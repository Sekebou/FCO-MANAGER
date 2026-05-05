-- Allow authenticated users to read all TV channels (active or not)
-- so we can show a "TV fermée" state when admin closes the stream.
DROP POLICY IF EXISTS "Authenticated can view active channels" ON public.tv_channels;
CREATE POLICY "Authenticated can view all channels"
ON public.tv_channels
FOR SELECT
TO authenticated
USING (true);
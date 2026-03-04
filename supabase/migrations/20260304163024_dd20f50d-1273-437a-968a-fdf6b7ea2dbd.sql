CREATE POLICY "Public can read pending invitations by id"
ON public.invitations
FOR SELECT
TO anon
USING (status = 'pending');
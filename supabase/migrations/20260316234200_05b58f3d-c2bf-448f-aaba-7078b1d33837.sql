CREATE POLICY "Anon can read invitations by invite_code"
ON public.invitations
FOR SELECT
TO anon
USING (invite_code IS NOT NULL AND status = 'pending');
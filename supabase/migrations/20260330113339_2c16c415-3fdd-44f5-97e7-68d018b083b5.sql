CREATE POLICY "Users can update own points"
ON public.user_points
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
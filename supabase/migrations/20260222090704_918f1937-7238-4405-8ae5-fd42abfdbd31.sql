CREATE POLICY "Users can delete own transactions"
  ON public.points_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- 1. Remove direct UPDATE on user_points (prevents balance manipulation)
DROP POLICY IF EXISTS "Users can update own points" ON public.user_points;

-- 2. Restrict invitations SELECT to authenticated only
DROP POLICY IF EXISTS "Invitations viewable by anyone" ON public.invitations;
CREATE POLICY "Invitations viewable by authenticated"
ON public.invitations FOR SELECT TO authenticated
USING (true);

-- 3. Add non-negative balance constraint
ALTER TABLE public.user_points ADD CONSTRAINT check_balance_non_negative CHECK (balance >= 0);

-- 4. Restrict news UPDATE to managers only (was USING(true))
DROP POLICY IF EXISTS "Managers can update news" ON public.news;
CREATE POLICY "Managers can update news"
ON public.news FOR UPDATE TO authenticated
USING (can_manage(auth.uid()) OR has_role(auth.uid(), 'dirigeant'::app_role));

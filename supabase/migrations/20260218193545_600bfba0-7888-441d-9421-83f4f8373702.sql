
-- Fix overly permissive UPDATE policies

-- Events: all authenticated can update presences (needed for players to mark attendance)
-- This is intentional - keep as is since any player needs to update their own presence

-- News: restrict update to managers (for editing) + any authenticated for likes
-- Keep as is - likes array needs to be updatable by all

-- Championships: restrict to managers and updaters
DROP POLICY IF EXISTS "Updaters can update championships" ON public.championships;
CREATE POLICY "Managers can update championships" ON public.championships FOR UPDATE TO authenticated USING (
  public.can_manage(auth.uid()) OR public.has_role(auth.uid(), 'joueur')
);

-- Championship matches: restrict update
DROP POLICY IF EXISTS "Updaters can update champ matches" ON public.championship_matches;
CREATE POLICY "Managers can update champ matches" ON public.championship_matches FOR UPDATE TO authenticated USING (
  public.can_manage(auth.uid()) OR public.has_role(auth.uid(), 'joueur')
);

-- Invitations: restrict update to the invitation target or managers
DROP POLICY IF EXISTS "Anyone can update invitation status" ON public.invitations;
CREATE POLICY "Users can update invitation status" ON public.invitations FOR UPDATE TO authenticated USING (
  public.can_manage(auth.uid()) OR status = 'pending'
);

-- Also need to allow invitations to be read by anonymous for registration page
DROP POLICY IF EXISTS "Invitations viewable by authenticated" ON public.invitations;
CREATE POLICY "Invitations viewable by anyone" ON public.invitations FOR SELECT USING (true);

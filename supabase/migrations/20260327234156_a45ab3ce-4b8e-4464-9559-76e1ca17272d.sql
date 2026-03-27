
-- Add unique partial index on match_sheets.event_id (only where event_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_sheets_event_id_unique 
ON public.match_sheets (event_id) 
WHERE event_id IS NOT NULL;

-- Fix role inconsistency: admin+ user (Maxime Boussekey) has 'admin' in user_roles instead of 'admin_plus'
DELETE FROM public.user_roles WHERE user_id = '274c4d75-e10c-4749-87fb-41b0cb5d9e25';
INSERT INTO public.user_roles (user_id, role) VALUES ('274c4d75-e10c-4749-87fb-41b0cb5d9e25', 'admin_plus');

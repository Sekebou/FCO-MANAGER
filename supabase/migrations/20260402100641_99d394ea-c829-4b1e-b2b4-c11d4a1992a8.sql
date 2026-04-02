
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  target_name text NOT NULL,
  target_email text,
  target_role text,
  performed_by uuid,
  performed_by_name text,
  details jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

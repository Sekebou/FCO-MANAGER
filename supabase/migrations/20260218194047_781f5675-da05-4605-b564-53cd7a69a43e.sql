
-- Trigger: auto-insert user_role when a profile is created
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapped_role app_role;
BEGIN
  CASE NEW.role
    WHEN 'admin+' THEN mapped_role := 'admin_plus';
    WHEN 'admin' THEN mapped_role := 'admin';
    WHEN 'entraineur' THEN mapped_role := 'entraineur';
    WHEN 'joueur' THEN mapped_role := 'joueur';
    WHEN 'photographe' THEN mapped_role := 'photographe';
    WHEN 'dirigeant' THEN mapped_role := 'dirigeant';
    ELSE mapped_role := 'joueur';
  END CASE;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, mapped_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_profile();

-- Trigger: sync user_role when profile role is updated
CREATE OR REPLACE FUNCTION public.handle_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapped_role app_role;
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    CASE NEW.role
      WHEN 'admin+' THEN mapped_role := 'admin_plus';
      WHEN 'admin' THEN mapped_role := 'admin';
      WHEN 'entraineur' THEN mapped_role := 'entraineur';
      WHEN 'joueur' THEN mapped_role := 'joueur';
      WHEN 'photographe' THEN mapped_role := 'photographe';
      WHEN 'dirigeant' THEN mapped_role := 'dirigeant';
      ELSE mapped_role := 'joueur';
    END CASE;

    DELETE FROM public.user_roles WHERE user_id = NEW.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, mapped_role);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_role_updated
AFTER UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_role_update();

-- Add unique constraint on user_roles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

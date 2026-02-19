
-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow admins to delete user_roles (needed for cleanup)
CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow managers to delete attendance records
CREATE POLICY "Managers can delete attendance"
ON public.attendance_records
FOR DELETE
TO authenticated
USING (public.can_manage(auth.uid()));

-- Allow managers to delete cards
-- (already exists but let's make sure)

-- Allow admins to delete invitations
CREATE POLICY "Admins can delete invitations"
ON public.invitations
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));


-- Make the photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'photos';

-- Add RLS policies for authenticated access to photos bucket
-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- Allow photo managers (admin, photographe) to upload
CREATE POLICY "Photo managers can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' 
  AND (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'photographe'::public.app_role)
  )
);

-- Allow photo managers to delete
CREATE POLICY "Photo managers can delete photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos' 
  AND (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'photographe'::public.app_role)
  )
);

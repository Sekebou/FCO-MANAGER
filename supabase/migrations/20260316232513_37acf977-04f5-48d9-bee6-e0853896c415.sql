CREATE POLICY "Public read access on photos bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');
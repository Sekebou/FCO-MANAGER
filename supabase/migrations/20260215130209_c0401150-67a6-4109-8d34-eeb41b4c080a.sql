
-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);

-- Allow public read access
CREATE POLICY "Photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

-- Allow authenticated uploads via service role (edge function handles this)
-- No direct upload policy needed since edge function uses service role

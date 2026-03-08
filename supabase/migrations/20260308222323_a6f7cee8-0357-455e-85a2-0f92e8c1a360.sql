
-- Add likes array to gallery_photos
ALTER TABLE public.gallery_photos ADD COLUMN IF NOT EXISTS likes uuid[] DEFAULT '{}';

-- Create photo_comments table
CREATE TABLE public.photo_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.gallery_photos(id) ON DELETE CASCADE,
  author_uid uuid NOT NULL,
  author_name text NOT NULL,
  author_photo text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

-- RLS: everyone can read
CREATE POLICY "Photo comments viewable by authenticated"
  ON public.photo_comments FOR SELECT TO authenticated
  USING (true);

-- RLS: authenticated can insert own comments
CREATE POLICY "Authenticated can insert photo comments"
  ON public.photo_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_uid);

-- RLS: author or admin can delete
CREATE POLICY "Author or admin can delete photo comments"
  ON public.photo_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_uid OR is_admin(auth.uid()));

-- RLS: allow authenticated to update gallery_photos for likes
CREATE POLICY "Authenticated can update photo likes"
  ON public.gallery_photos FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

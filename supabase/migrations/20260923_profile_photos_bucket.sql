-- Supabase Storage Bucket Configuration for User Profile Photos

-- 1. Create the 'profile-photos' bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Allow public read access to all files in 'profile-photos' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Public read access for profile photos'
  ) THEN
    CREATE POLICY "Public read access for profile photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile-photos');
  END IF;
END $$;

-- 3. Allow authenticated users to upload their own profile photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload profile photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload profile photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'profile-photos' 
      AND auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- 4. Allow authenticated users to update their own profile photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can update their profile photos'
  ) THEN
    CREATE POLICY "Authenticated users can update their profile photos"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'profile-photos' 
      AND auth.role() = 'authenticated'
    );
  END IF;
END $$;

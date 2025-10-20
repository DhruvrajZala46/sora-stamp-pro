-- Add DELETE policy for processed storage bucket to allow users to clean up their files
CREATE POLICY "Users can delete own processed files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'processed' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add DELETE policy for profiles table for GDPR compliance
CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);
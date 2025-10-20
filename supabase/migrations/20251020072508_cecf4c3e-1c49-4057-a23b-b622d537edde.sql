-- Add DELETE policy for uploads storage bucket
-- Allow users to delete their own uploaded files
CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'uploads' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);
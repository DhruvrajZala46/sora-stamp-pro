-- Enable complete row data for realtime updates on videos
ALTER TABLE public.videos REPLICA IDENTITY FULL;

-- Ensure the videos table emits realtime events
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
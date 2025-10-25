-- Create feedback submissions table
CREATE TABLE public.feedback_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (no auth required)
CREATE POLICY "Anyone can submit feedback" 
ON public.feedback_submissions 
FOR INSERT 
WITH CHECK (true);

-- Only allow viewing own feedback if authenticated
CREATE POLICY "Users can view own feedback" 
ON public.feedback_submissions 
FOR SELECT 
USING (false);

-- Create index for faster queries
CREATE INDEX idx_feedback_created_at ON public.feedback_submissions(created_at DESC);
-- Add length constraints to feedback_submissions table for security
ALTER TABLE public.feedback_submissions
ADD CONSTRAINT email_length_check CHECK (char_length(email) <= 255),
ADD CONSTRAINT message_length_check CHECK (char_length(message) >= 10 AND char_length(message) <= 1000);
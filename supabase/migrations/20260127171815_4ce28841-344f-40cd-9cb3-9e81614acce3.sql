-- Add broadcast_deadline column to events table for video submission deadline
ALTER TABLE public.events 
ADD COLUMN broadcast_deadline date;
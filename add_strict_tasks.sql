-- Add strict task functionality to the tasks table
-- Run this in Supabase SQL Editor

-- Add the is_strict column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_strict BOOLEAN DEFAULT FALSE;

-- Create index for performance when querying strict tasks
CREATE INDEX IF NOT EXISTS idx_tasks_is_strict ON public.tasks(is_strict);

-- Update existing tasks to be non-strict by default (just to be explicit)
UPDATE public.tasks 
SET is_strict = FALSE 
WHERE is_strict IS NULL;

-- Add comment to document the feature
COMMENT ON COLUMN public.tasks.is_strict IS 'When true, task becomes locked/inactive after deadline passes and cannot be completed late';
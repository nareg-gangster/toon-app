-- Add enabled/disabled state for recurring tasks
-- This allows parents to pause/resume recurring task creation

-- Add the enabled field to the tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_recurring_enabled BOOLEAN DEFAULT true;

-- Add comment to explain the field
COMMENT ON COLUMN public.tasks.is_recurring_enabled IS 'For recurring task templates: true = creates new tasks automatically, false = paused/disabled';

-- Update existing recurring task templates to be enabled by default
UPDATE public.tasks 
SET is_recurring_enabled = true 
WHERE is_recurring = true AND parent_task_id IS NULL;

-- Create an index for better performance when filtering enabled recurring tasks
CREATE INDEX IF NOT EXISTS idx_tasks_recurring_enabled 
ON public.tasks (is_recurring, is_recurring_enabled) 
WHERE is_recurring = true AND parent_task_id IS NULL;
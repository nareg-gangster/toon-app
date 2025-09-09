-- ADD NEW FIELDS FOR RECURRING TASK DAY/DATE SELECTION
-- Run this in Supabase SQL Editor

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS recurring_day_of_week integer, -- 0=Sunday, 1=Monday, ..., 6=Saturday (for weekly)
ADD COLUMN IF NOT EXISTS recurring_day_of_month integer; -- 1-31 (for monthly)

-- Add constraints
ALTER TABLE public.tasks 
ADD CONSTRAINT check_recurring_day_of_week 
  CHECK (recurring_day_of_week IS NULL OR (recurring_day_of_week >= 0 AND recurring_day_of_week <= 6));

ALTER TABLE public.tasks 
ADD CONSTRAINT check_recurring_day_of_month 
  CHECK (recurring_day_of_month IS NULL OR (recurring_day_of_month >= 1 AND recurring_day_of_month <= 31));

-- Add comments
COMMENT ON COLUMN public.tasks.recurring_day_of_week IS 'Day of week for weekly recurring tasks (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN public.tasks.recurring_day_of_month IS 'Day of month for monthly recurring tasks (1-31)';

-- Update the view to include new fields
CREATE OR REPLACE VIEW public.active_recurring_templates AS
SELECT 
  t.*,
  u.name as assigned_user_name,
  creator.name as created_by_name
FROM public.tasks t
LEFT JOIN public.users u ON t.assigned_to = u.id
LEFT JOIN public.users creator ON t.created_by = creator.id
WHERE t.is_recurring = true 
  AND t.parent_task_id IS NULL;
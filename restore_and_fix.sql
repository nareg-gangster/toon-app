-- RESTORE AND FIX RECURRING TASKS SYSTEM
-- Run this in Supabase SQL Editor

-- 1. Restore the simple views (the functions approach was too complex)
CREATE OR REPLACE VIEW public.active_recurring_templates AS
SELECT 
  t.*,
  u.name as assigned_user_name,
  creator.name as created_by_name
FROM public.tasks t
LEFT JOIN public.users u ON t.assigned_to = u.id
LEFT JOIN public.users creator ON t.created_by = creator.id
WHERE t.is_recurring = true 
  AND t.parent_task_id IS NULL; -- Templates have no parent

-- 2. Fix the overdue view to only look at instances, not templates
CREATE OR REPLACE VIEW public.overdue_tasks_with_penalties AS
SELECT 
  t.*,
  u.name as assigned_user_name,
  u.points as current_user_points,
  EXTRACT(hours FROM (NOW() - t.due_date)) as hours_overdue
FROM public.tasks t
JOIN public.users u ON t.assigned_to = u.id
WHERE t.due_date < NOW()
  AND t.status NOT IN ('approved', 'archived')
  AND t.penalty_points > 0
  AND t.penalized_at IS NULL
  AND (t.is_recurring = false OR t.parent_task_id IS NOT NULL); -- Only instances

-- 3. Fix hanging tasks view
CREATE OR REPLACE VIEW public.available_hanging_tasks AS
SELECT 
  t.*,
  creator.name as created_by_name,
  f.name as family_name
FROM public.tasks t
JOIN public.users creator ON t.created_by = creator.id
JOIN public.families f ON t.family_id = f.id
WHERE t.task_type = 'hanging'
  AND t.is_available_for_pickup = true
  AND t.status = 'pending'
  AND (t.is_recurring = false OR t.parent_task_id IS NOT NULL); -- Only instances

-- 4. Fix the daily generation function to create instances with pending status
CREATE OR REPLACE FUNCTION public.generate_daily_recurring_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template_record RECORD;
  target_date DATE := CURRENT_DATE;
  due_datetime TIMESTAMPTZ;
BEGIN
  -- Loop through all recurring templates (not approved ones, but pending/active ones)
  FOR template_record IN 
    SELECT * FROM public.tasks 
    WHERE is_recurring = true 
      AND parent_task_id IS NULL 
      AND recurring_pattern = 'daily'
      AND status IN ('pending', 'in_progress', 'approved') -- Active templates
  LOOP
    -- Check if task already exists for today
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE parent_task_id = template_record.id 
        AND DATE(due_date) = target_date
    ) THEN
      -- Calculate due datetime
      due_datetime := target_date + COALESCE(template_record.recurring_time || ':00', '23:59:59')::TIME;
      
      -- Create new task instance with PENDING status (not approved!)
      INSERT INTO public.tasks (
        title,
        description,
        points,
        penalty_points,
        due_date,
        assigned_to,
        created_by,
        family_id,
        task_type,
        transferable,
        parent_task_id,
        is_recurring,
        status -- This should be PENDING, not approved!
      ) VALUES (
        template_record.title,
        template_record.description,
        template_record.points,
        COALESCE(template_record.penalty_points, 0),
        due_datetime,
        template_record.assigned_to,
        template_record.created_by,
        template_record.family_id,
        COALESCE(template_record.task_type, 'non_negotiable'),
        COALESCE(template_record.transferable, false),
        template_record.id,
        false, -- Instance is not recurring
        'pending' -- Start as pending, not approved!
      );
    END IF;
  END LOOP;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.active_recurring_templates TO authenticated;
GRANT SELECT ON public.overdue_tasks_with_penalties TO authenticated;  
GRANT SELECT ON public.available_hanging_tasks TO authenticated;
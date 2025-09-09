-- IMMEDIATE RECURRING TASK GENERATION - EVENT DRIVEN
-- Run this in Supabase SQL Editor for immediate task creation

-- Function to generate next recurring task instance immediately
CREATE OR REPLACE FUNCTION public.generate_next_recurring_task_immediate(
  template_id UUID,
  current_due_date TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template_record RECORD;
  next_due_date TIMESTAMPTZ;
  existing_task_id UUID;
  new_task_id UUID;
BEGIN
  -- Get the template
  SELECT * INTO template_record
  FROM public.tasks
  WHERE id = template_id
    AND is_recurring = true
    AND status IN ('pending', 'in_progress', 'approved');
    
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Calculate next due date based on recurring pattern
  CASE template_record.recurring_pattern
    WHEN 'daily' THEN
      next_due_date := DATE_TRUNC('day', current_due_date) + INTERVAL '1 day';
      IF template_record.recurring_time IS NOT NULL THEN
        next_due_date := next_due_date + template_record.recurring_time::TIME;
      END IF;
      
    WHEN 'weekly' THEN
      next_due_date := current_due_date + INTERVAL '7 days';
      
    WHEN 'monthly' THEN
      next_due_date := current_due_date + INTERVAL '1 month';
      
    ELSE
      -- Unknown pattern, default to daily
      next_due_date := DATE_TRUNC('day', current_due_date) + INTERVAL '1 day';
      IF template_record.recurring_time IS NOT NULL THEN
        next_due_date := next_due_date + template_record.recurring_time::TIME;
      END IF;
  END CASE;
  
  -- Check if next instance already exists
  SELECT id INTO existing_task_id
  FROM public.tasks
  WHERE parent_task_id = template_id
    AND DATE(due_date) = DATE(next_due_date);
    
  IF existing_task_id IS NOT NULL THEN
    RETURN existing_task_id; -- Already exists
  END IF;
  
  -- Create new task instance
  INSERT INTO public.tasks (
    title, description, points, penalty_points, due_date,
    assigned_to, created_by, family_id, task_type, transferable,
    parent_task_id, is_recurring, status
  ) VALUES (
    template_record.title,
    template_record.description,
    template_record.points,
    COALESCE(template_record.penalty_points, 0),
    next_due_date,
    template_record.assigned_to,
    template_record.created_by,
    template_record.family_id,
    COALESCE(template_record.task_type, 'non_negotiable'),
    COALESCE(template_record.transferable, false),
    template_id,
    false, -- Instance is not recurring
    'pending'
  ) RETURNING id INTO new_task_id;
  
  RAISE NOTICE 'Generated next recurring task: % (%) for %', 
               template_record.title, new_task_id, next_due_date;
  
  RETURN new_task_id;
END;
$$;

-- Function to check and generate overdue recurring tasks immediately
CREATE OR REPLACE FUNCTION public.check_and_generate_overdue_recurring()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  overdue_record RECORD;
  generated_count INTEGER := 0;
  new_task_id UUID;
  result json;
BEGIN
  RAISE NOTICE 'Checking for overdue recurring tasks...';
  
  -- Find all overdue recurring task instances that need next instances
  FOR overdue_record IN 
    SELECT DISTINCT t.parent_task_id, t.due_date
    FROM public.tasks t
    WHERE t.parent_task_id IS NOT NULL  -- Only recurring instances
      AND t.due_date < NOW()           -- Past deadline
      AND t.status != 'archived'       -- Not archived
      -- Ensure we don't already have a newer instance
      AND NOT EXISTS (
        SELECT 1 FROM public.tasks newer
        WHERE newer.parent_task_id = t.parent_task_id
          AND newer.due_date > t.due_date
      )
  LOOP
    -- Generate next instance
    SELECT public.generate_next_recurring_task_immediate(
      overdue_record.parent_task_id, 
      overdue_record.due_date
    ) INTO new_task_id;
    
    IF new_task_id IS NOT NULL THEN
      generated_count := generated_count + 1;
    END IF;
  END LOOP;
  
  result := json_build_object(
    'generated', generated_count,
    'timestamp', NOW()
  );
  
  RAISE NOTICE 'Generated % overdue recurring task instances', generated_count;
  RETURN result;
END;
$$;

-- Trigger function that runs when tasks are updated/inserted
CREATE OR REPLACE FUNCTION public.trigger_check_overdue_recurring()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger for recurring task instances that became overdue
  IF (NEW.parent_task_id IS NOT NULL AND NEW.due_date < NOW()) THEN
    -- Schedule async generation (non-blocking)
    PERFORM pg_notify('overdue_recurring_task', json_build_object(
      'parent_task_id', NEW.parent_task_id,
      'due_date', NEW.due_date
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on tasks table
DROP TRIGGER IF EXISTS trigger_overdue_recurring_tasks ON public.tasks;
CREATE TRIGGER trigger_overdue_recurring_tasks
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_check_overdue_recurring();

-- Function to be called by clients for immediate check
CREATE OR REPLACE FUNCTION public.ensure_current_recurring_tasks()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- This function can be called by clients to ensure all current recurring tasks exist
  SELECT public.check_and_generate_overdue_recurring() INTO result;
  RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_next_recurring_task_immediate(UUID, TIMESTAMPTZ) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_and_generate_overdue_recurring() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_recurring_tasks() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_recurring_tasks() TO service_role;
-- SQL FUNCTION FOR AUTOMATIC RECURRING TASK GENERATION
-- Run this in Supabase SQL Editor to add database-level recurring task generation

CREATE OR REPLACE FUNCTION public.generate_overdue_recurring_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  generated_count INTEGER := 0;
  overdue_record RECORD;
  template_record RECORD;
  next_due_date TIMESTAMPTZ;
  existing_task_id UUID;
  new_task_id UUID;
BEGIN
  RAISE NOTICE 'Starting overdue recurring task generation...';
  
  -- Get all overdue recurring task instances
  FOR overdue_record IN 
    SELECT DISTINCT t.parent_task_id, t.due_date
    FROM public.tasks t
    WHERE t.parent_task_id IS NOT NULL  -- Only recurring instances
      AND t.due_date < NOW()           -- Past deadline
      AND t.status != 'archived'       -- Not archived
  LOOP
    -- Get the template
    SELECT * INTO template_record 
    FROM public.tasks 
    WHERE id = overdue_record.parent_task_id 
      AND is_recurring = true;
    
    IF NOT FOUND THEN
      RAISE NOTICE 'Template not found for parent_task_id: %', overdue_record.parent_task_id;
      CONTINUE;
    END IF;
    
    -- Calculate next due date based on pattern
    CASE template_record.recurring_pattern
      WHEN 'daily' THEN
        next_due_date := DATE_TRUNC('day', overdue_record.due_date) + INTERVAL '1 day';
        IF template_record.recurring_time IS NOT NULL THEN
          next_due_date := next_due_date + template_record.recurring_time::TIME;
        END IF;
      WHEN 'weekly' THEN
        next_due_date := DATE_TRUNC('day', overdue_record.due_date) + INTERVAL '7 days';
        IF template_record.recurring_time IS NOT NULL THEN
          next_due_date := next_due_date + template_record.recurring_time::TIME;
        END IF;
      WHEN 'monthly' THEN
        next_due_date := DATE_TRUNC('day', overdue_record.due_date) + INTERVAL '1 month';
        IF template_record.recurring_time IS NOT NULL THEN
          next_due_date := next_due_date + template_record.recurring_time::TIME;
        END IF;
      ELSE
        -- Default to daily
        next_due_date := DATE_TRUNC('day', overdue_record.due_date) + INTERVAL '1 day';
    END CASE;
    
    -- Check if next instance already exists
    SELECT id INTO existing_task_id
    FROM public.tasks
    WHERE parent_task_id = template_record.id
      AND DATE(due_date) = DATE(next_due_date)
    LIMIT 1;
    
    IF existing_task_id IS NOT NULL THEN
      RAISE NOTICE 'Next instance already exists for template: %', template_record.title;
      CONTINUE;
    END IF;
    
    -- Create new recurring task instance
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
      template_record.id,
      false, -- Instance is not recurring
      'pending' -- Start as pending
    ) RETURNING id INTO new_task_id;
    
    generated_count := generated_count + 1;
    RAISE NOTICE 'Generated new recurring task instance: % (ID: %)', template_record.title, new_task_id;
  END LOOP;
  
  RAISE NOTICE 'Generated % new recurring task instances', generated_count;
  RETURN generated_count;
END;
$$;

-- Update the penalty processing function to call recurring task generation
CREATE OR REPLACE FUNCTION public.process_overdue_penalties()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  penalty_count INTEGER := 0;
  generated_count INTEGER := 0;
  overdue_record RECORD;
BEGIN
  RAISE NOTICE 'Starting penalty processing...';
  
  -- First, generate new recurring task instances for overdue tasks
  SELECT public.generate_overdue_recurring_tasks() INTO generated_count;
  RAISE NOTICE 'Generated % new recurring instances', generated_count;
  
  -- Then process penalties as before
  FOR overdue_record IN 
    SELECT t.*, u.points as current_points, u.name as user_name
    FROM public.tasks t
    JOIN public.users u ON t.assigned_to = u.id
    WHERE t.due_date < NOW()
      AND t.status IN ('pending', 'in_progress')  -- Only pending/in_progress, NOT completed
      AND t.penalty_points > 0
      AND t.penalized_at IS NULL
      AND (t.is_recurring = false OR t.parent_task_id IS NOT NULL) -- Only instances
  LOOP
    -- Deduct penalty points from user
    UPDATE public.users 
    SET points = GREATEST(0, points - overdue_record.penalty_points)
    WHERE id = overdue_record.assigned_to;
    
    -- Mark task as penalized and rejected
    UPDATE public.tasks 
    SET penalized_at = NOW(),
        status = 'rejected',
        rejection_reason = COALESCE(rejection_reason, '') || ' [PENALTY: -' || overdue_record.penalty_points || ' points for missing deadline]'
    WHERE id = overdue_record.id;
    
    penalty_count := penalty_count + 1;
    RAISE NOTICE 'Applied penalty: -%d points to %', overdue_record.penalty_points, overdue_record.user_name;
  END LOOP;
  
  RAISE NOTICE 'Penalty processing completed. Processed % tasks, generated % recurring instances', penalty_count, generated_count;
  RETURN penalty_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_overdue_recurring_tasks() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_overdue_penalties() TO service_role;
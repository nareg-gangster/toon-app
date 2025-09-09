-- IMPROVED SQL FUNCTIONS FOR RECURRING TASKS
-- Run this in Supabase SQL Editor

-- 1. Improved daily task generation with better overdue handling
CREATE OR REPLACE FUNCTION public.generate_daily_recurring_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template_record RECORD;
  target_date DATE := CURRENT_DATE;
  due_datetime TIMESTAMPTZ;
  existing_overdue_count INTEGER;
BEGIN
  RAISE NOTICE 'Starting daily task generation for %', target_date;
  
  -- Loop through all recurring templates
  FOR template_record IN 
    SELECT * FROM public.tasks 
    WHERE is_recurring = true 
      AND parent_task_id IS NULL 
      AND recurring_pattern = 'daily'
      AND status IN ('pending', 'in_progress', 'approved')
  LOOP
    RAISE NOTICE 'Processing template: %', template_record.title;
    
    -- Check if task already exists for today
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE parent_task_id = template_record.id 
        AND DATE(due_date) = target_date
    ) THEN
      
      -- Check if there are overdue incomplete tasks from previous days
      SELECT COUNT(*) INTO existing_overdue_count
      FROM public.tasks 
      WHERE parent_task_id = template_record.id 
        AND due_date < (target_date || ' 00:00:00')::TIMESTAMPTZ
        AND status NOT IN ('approved', 'archived', 'rejected');
      
      -- If there are overdue tasks, mark them as overdue first
      IF existing_overdue_count > 0 THEN
        UPDATE public.tasks 
        SET status = 'rejected',
            rejection_reason = 'Missed deadline - marked overdue by system'
        WHERE parent_task_id = template_record.id 
          AND due_date < (target_date || ' 00:00:00')::TIMESTAMPTZ
          AND status NOT IN ('approved', 'archived', 'rejected');
        
        RAISE NOTICE 'Marked % overdue tasks as rejected for template %', existing_overdue_count, template_record.title;
      END IF;
      
      -- Calculate due datetime for today
      due_datetime := target_date + COALESCE(template_record.recurring_time || ':00', '23:59:00')::TIME;
      
      -- Create new task instance for today
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
        status
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
        'pending' -- Start as pending
      );
      
      RAISE NOTICE 'Created new daily task for % due at %', template_record.title, due_datetime;
    ELSE
      RAISE NOTICE 'Task already exists for % on %', template_record.title, target_date;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Daily task generation completed';
END;
$$;

-- 2. Improved penalty processing with better logic
CREATE OR REPLACE FUNCTION public.process_overdue_penalties()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  penalty_count INTEGER := 0;
  overdue_record RECORD;
BEGIN
  RAISE NOTICE 'Starting penalty processing...';
  
  -- Process all overdue tasks with penalties
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
    RAISE NOTICE 'Processing overdue task: % for user %', overdue_record.title, overdue_record.user_name;
    
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
  
  RAISE NOTICE 'Penalty processing completed. Processed % tasks', penalty_count;
  RETURN penalty_count;
END;
$$;

-- 3. Function to check for template status and create missing today's task
CREATE OR REPLACE FUNCTION public.ensure_todays_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template_record RECORD;
  today_date DATE := CURRENT_DATE;
  due_datetime TIMESTAMPTZ;
BEGIN
  -- This function ensures that every active template has today's task
  FOR template_record IN 
    SELECT * FROM public.tasks 
    WHERE is_recurring = true 
      AND parent_task_id IS NULL 
      AND recurring_pattern = 'daily'
      AND status IN ('pending', 'in_progress', 'approved')
  LOOP
    -- Check if today's task exists
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE parent_task_id = template_record.id 
        AND DATE(due_date) = today_date
    ) THEN
      -- Create today's task
      due_datetime := today_date + COALESCE(template_record.recurring_time || ':00', '23:59:00')::TIME;
      
      INSERT INTO public.tasks (
        title, description, points, penalty_points, due_date,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, status
      ) VALUES (
        template_record.title, template_record.description, template_record.points, 
        COALESCE(template_record.penalty_points, 0), due_datetime,
        template_record.assigned_to, template_record.created_by, template_record.family_id, 
        COALESCE(template_record.task_type, 'non_negotiable'), COALESCE(template_record.transferable, false),
        template_record.id, false, 'pending'
      );
    END IF;
  END LOOP;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_daily_recurring_tasks() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_overdue_penalties() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_todays_tasks() TO service_role;
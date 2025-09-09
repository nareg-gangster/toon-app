-- DEADLINE-BASED RECURRING TASK GENERATION
-- Run this in Supabase SQL Editor to fix recurring task generation

-- Create the main function that your edge function calls
CREATE OR REPLACE FUNCTION public.generate_all_recurring_tasks()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  daily_count INTEGER := 0;
  weekly_count INTEGER := 0;
  monthly_count INTEGER := 0;
  template_record RECORD;
  next_due_date TIMESTAMPTZ;
  existing_task_id UUID;
BEGIN
  RAISE NOTICE 'Starting deadline-based recurring task generation...';
  
  -- =================================================================
  -- DAILY TASKS: Generate next instance if current one has passed deadline
  -- =================================================================
  FOR template_record IN 
    SELECT * FROM public.tasks 
    WHERE is_recurring = true 
      AND parent_task_id IS NULL 
      AND recurring_pattern = 'daily'
      AND status IN ('pending', 'in_progress', 'approved')
      AND (is_recurring_enabled IS NULL OR is_recurring_enabled = true)
  LOOP
    -- Find the most recent instance of this template
    SELECT due_date INTO next_due_date
    FROM public.tasks 
    WHERE parent_task_id = template_record.id 
    ORDER BY due_date DESC 
    LIMIT 1;
    
    IF next_due_date IS NULL THEN
      -- No instances yet, create first one for today
      next_due_date := CURRENT_DATE;
      IF template_record.recurring_time IS NOT NULL THEN
        next_due_date := next_due_date + template_record.recurring_time::TIME;
      END IF;
    ELSE
      -- Check if the most recent instance has passed its deadline
      IF next_due_date <= NOW() THEN
        -- Generate next day's task
        next_due_date := DATE_TRUNC('day', next_due_date) + INTERVAL '1 day';
        IF template_record.recurring_time IS NOT NULL THEN
          next_due_date := next_due_date + template_record.recurring_time::TIME;
        END IF;
      ELSE
        -- Current instance hasn't passed deadline yet, skip
        CONTINUE;
      END IF;
    END IF;
    
    -- Check if next instance already exists
    SELECT id INTO existing_task_id
    FROM public.tasks
    WHERE parent_task_id = template_record.id
      AND DATE(due_date) = DATE(next_due_date)
    LIMIT 1;
    
    IF existing_task_id IS NULL THEN
      -- Create new daily task instance
      INSERT INTO public.tasks (
        title, description, points, penalty_points, due_date,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, status
      ) VALUES (
        template_record.title, template_record.description, template_record.points,
        COALESCE(template_record.penalty_points, 0), next_due_date,
        template_record.assigned_to, template_record.created_by, template_record.family_id,
        COALESCE(template_record.task_type, 'non_negotiable'), 
        COALESCE(template_record.transferable, false),
        template_record.id, false, 'pending'
      );
      
      daily_count := daily_count + 1;
      RAISE NOTICE 'Generated daily task: % for %', template_record.title, next_due_date;
    END IF;
  END LOOP;

  -- =================================================================
  -- WEEKLY TASKS: Generate next instance if current one has passed deadline
  -- =================================================================
  FOR template_record IN 
    SELECT * FROM public.tasks 
    WHERE is_recurring = true 
      AND parent_task_id IS NULL 
      AND recurring_pattern = 'weekly'
      AND status IN ('pending', 'in_progress', 'approved')
      AND (is_recurring_enabled IS NULL OR is_recurring_enabled = true)
  LOOP
    -- Find the most recent instance of this template
    SELECT due_date INTO next_due_date
    FROM public.tasks 
    WHERE parent_task_id = template_record.id 
    ORDER BY due_date DESC 
    LIMIT 1;
    
    IF next_due_date IS NULL THEN
      -- No instances yet, create first one for this week's target day
      next_due_date := DATE_TRUNC('week', CURRENT_DATE) + 
                       (COALESCE(template_record.recurring_day_of_week, 1) || ' days')::INTERVAL;
      
      IF template_record.recurring_time IS NOT NULL THEN
        next_due_date := next_due_date + template_record.recurring_time::TIME;
      END IF;
      
      -- If target day has already passed this week, move to next week
      IF next_due_date <= NOW() THEN
        next_due_date := next_due_date + INTERVAL '7 days';
      END IF;
    ELSE
      -- Check if the most recent instance has passed its deadline
      IF next_due_date <= NOW() THEN
        -- Generate next week's task
        next_due_date := next_due_date + INTERVAL '7 days';
      ELSE
        -- Current instance hasn't passed deadline yet, skip
        CONTINUE;
      END IF;
    END IF;
    
    -- Check if next instance already exists
    SELECT id INTO existing_task_id
    FROM public.tasks
    WHERE parent_task_id = template_record.id
      AND DATE(due_date) = DATE(next_due_date)
    LIMIT 1;
    
    IF existing_task_id IS NULL THEN
      -- Create new weekly task instance
      INSERT INTO public.tasks (
        title, description, points, penalty_points, due_date,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, status
      ) VALUES (
        template_record.title, template_record.description, template_record.points,
        COALESCE(template_record.penalty_points, 0), next_due_date,
        template_record.assigned_to, template_record.created_by, template_record.family_id,
        COALESCE(template_record.task_type, 'non_negotiable'), 
        COALESCE(template_record.transferable, false),
        template_record.id, false, 'pending'
      );
      
      weekly_count := weekly_count + 1;
      RAISE NOTICE 'Generated weekly task: % for %', template_record.title, next_due_date;
    END IF;
  END LOOP;

  -- =================================================================
  -- MONTHLY TASKS: Generate next instance if current one has passed deadline
  -- =================================================================
  FOR template_record IN 
    SELECT * FROM public.tasks 
    WHERE is_recurring = true 
      AND parent_task_id IS NULL 
      AND recurring_pattern = 'monthly'
      AND status IN ('pending', 'in_progress', 'approved')
      AND (is_recurring_enabled IS NULL OR is_recurring_enabled = true)
  LOOP
    -- Find the most recent instance of this template
    SELECT due_date INTO next_due_date
    FROM public.tasks 
    WHERE parent_task_id = template_record.id 
    ORDER BY due_date DESC 
    LIMIT 1;
    
    IF next_due_date IS NULL THEN
      -- No instances yet, create first one for this month's target day
      next_due_date := DATE_TRUNC('month', CURRENT_DATE) + 
                       (COALESCE(template_record.recurring_day_of_month, 1) - 1 || ' days')::INTERVAL;
      
      IF template_record.recurring_time IS NOT NULL THEN
        next_due_date := next_due_date + template_record.recurring_time::TIME;
      END IF;
      
      -- If target day has already passed this month, move to next month
      IF next_due_date <= NOW() THEN
        next_due_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') + 
                         (COALESCE(template_record.recurring_day_of_month, 1) - 1 || ' days')::INTERVAL;
        IF template_record.recurring_time IS NOT NULL THEN
          next_due_date := next_due_date + template_record.recurring_time::TIME;
        END IF;
      END IF;
    ELSE
      -- Check if the most recent instance has passed its deadline
      IF next_due_date <= NOW() THEN
        -- Generate next month's task
        next_due_date := next_due_date + INTERVAL '1 month';
      ELSE
        -- Current instance hasn't passed deadline yet, skip
        CONTINUE;
      END IF;
    END IF;
    
    -- Check if next instance already exists
    SELECT id INTO existing_task_id
    FROM public.tasks
    WHERE parent_task_id = template_record.id
      AND DATE(due_date) = DATE(next_due_date)
    LIMIT 1;
    
    IF existing_task_id IS NULL THEN
      -- Create new monthly task instance
      INSERT INTO public.tasks (
        title, description, points, penalty_points, due_date,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, status
      ) VALUES (
        template_record.title, template_record.description, template_record.points,
        COALESCE(template_record.penalty_points, 0), next_due_date,
        template_record.assigned_to, template_record.created_by, template_record.family_id,
        COALESCE(template_record.task_type, 'non_negotiable'), 
        COALESCE(template_record.transferable, false),
        template_record.id, false, 'pending'
      );
      
      monthly_count := monthly_count + 1;
      RAISE NOTICE 'Generated monthly task: % for %', template_record.title, next_due_date;
    END IF;
  END LOOP;

  RAISE NOTICE 'Task generation completed - Daily: %, Weekly: %, Monthly: %', 
               daily_count, weekly_count, monthly_count;

  -- Return results as JSON
  RETURN json_build_object(
    'daily', daily_count,
    'weekly', weekly_count,
    'monthly', monthly_count,
    'total', daily_count + weekly_count + monthly_count,
    'timestamp', NOW()
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_all_recurring_tasks() TO service_role;

-- Test the function (you can run this to test)
-- SELECT public.generate_all_recurring_tasks();
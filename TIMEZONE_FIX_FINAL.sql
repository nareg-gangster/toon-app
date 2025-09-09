-- FINAL TIMEZONE FIX FOR RECURRING TASKS
-- This fixes the 4-hour shift issue in Armenia (UTC+4) timezone
-- Run this in Supabase SQL Editor to fix the timezone handling

-- 1. First, let's create a helper function that properly handles timezone conversion
CREATE OR REPLACE FUNCTION public.create_task_with_local_time(
  p_title TEXT,
  p_description TEXT,
  p_points INTEGER,
  p_penalty_points INTEGER,
  p_date_string TEXT, -- YYYY-MM-DD format
  p_time_string TEXT, -- HH:MM format
  p_assigned_to UUID,
  p_created_by UUID,
  p_family_id UUID,
  p_task_type TEXT,
  p_transferable BOOLEAN,
  p_parent_task_id UUID,
  p_recurring_pattern TEXT,
  p_timezone TEXT DEFAULT 'Asia/Yerevan'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_task_id UUID;
  local_datetime TIMESTAMPTZ;
BEGIN
  -- Create the datetime in the specified timezone
  -- This explicitly tells PostgreSQL the timezone context
  local_datetime := (p_date_string || ' ' || p_time_string || ':00')::TIMESTAMP AT TIME ZONE p_timezone;
  
  -- Insert the task
  INSERT INTO public.tasks (
    title, description, points, penalty_points, due_date,
    assigned_to, created_by, family_id, task_type, transferable,
    parent_task_id, is_recurring, recurring_pattern, status
  ) VALUES (
    p_title, p_description, p_points, p_penalty_points, local_datetime,
    p_assigned_to, p_created_by, p_family_id, p_task_type, p_transferable,
    p_parent_task_id, false, p_recurring_pattern, 'pending'
  ) RETURNING id INTO new_task_id;
  
  RETURN new_task_id;
END;
$$;

-- 2. Update the main recurring task generation function with proper timezone handling
CREATE OR REPLACE FUNCTION public.ensure_current_recurring_tasks()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  generated_count INTEGER := 0;
  task_record RECORD;
  template_record RECORD;
  next_due_date DATE;
  next_due_time TIME;
  existing_task_id UUID;
  new_task_id UUID;
  timezone_name TEXT := 'Asia/Yerevan';
BEGIN
  RAISE NOTICE 'Starting timezone-aware recurring task check...';
  
  -- Find overdue recurring task instances that need next tasks
  FOR task_record IN 
    SELECT DISTINCT parent_task_id, due_date
    FROM public.tasks t
    WHERE parent_task_id IS NOT NULL  -- Only recurring instances
      AND due_date < NOW()           -- Past deadline
      AND status != 'archived'      -- Not archived
      AND NOT EXISTS (
        -- Don't process if there's already a newer instance
        SELECT 1 FROM public.tasks newer
        WHERE newer.parent_task_id = t.parent_task_id
          AND newer.due_date > t.due_date
          AND newer.due_date >= DATE_TRUNC('day', NOW())
      )
  LOOP
    -- Get the template
    SELECT * INTO template_record
    FROM public.tasks
    WHERE id = task_record.parent_task_id
      AND is_recurring = true
      AND status IN ('pending', 'in_progress', 'approved');
      
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    
    -- Calculate next due date based on pattern (DATE ONLY, no time)
    CASE template_record.recurring_pattern
      WHEN 'daily' THEN
        next_due_date := (task_record.due_date AT TIME ZONE timezone_name)::DATE + INTERVAL '1 day';
      WHEN 'weekly' THEN  
        next_due_date := (task_record.due_date AT TIME ZONE timezone_name)::DATE + INTERVAL '7 days';
      WHEN 'monthly' THEN
        next_due_date := (task_record.due_date AT TIME ZONE timezone_name)::DATE + INTERVAL '1 month';
      ELSE
        next_due_date := (task_record.due_date AT TIME ZONE timezone_name)::DATE + INTERVAL '1 day';
    END CASE;
    
    -- Extract the time component from the template (preserving the original time)
    IF template_record.recurring_time IS NOT NULL THEN
      next_due_time := template_record.recurring_time::TIME;
    ELSE
      -- Default to the same time as the original task
      next_due_time := (task_record.due_date AT TIME ZONE timezone_name)::TIME;
    END IF;
    
    -- Check if next instance already exists
    SELECT id INTO existing_task_id
    FROM public.tasks
    WHERE parent_task_id = template_record.id
      AND DATE(due_date AT TIME ZONE timezone_name) = next_due_date;
      
    IF existing_task_id IS NOT NULL THEN
      CONTINUE; -- Already exists
    END IF;
    
    -- Create new task instance using the timezone-aware helper function
    BEGIN
      SELECT public.create_task_with_local_time(
        template_record.title,
        template_record.description,
        template_record.points,
        COALESCE(template_record.penalty_points, 0),
        next_due_date::TEXT, -- Date as string
        next_due_time::TEXT, -- Time as string
        template_record.assigned_to,
        template_record.created_by,
        template_record.family_id,
        COALESCE(template_record.task_type, 'non_negotiable'),
        COALESCE(template_record.transferable, false),
        template_record.id,
        template_record.recurring_pattern,
        timezone_name
      ) INTO new_task_id;
      
      generated_count := generated_count + 1;
      RAISE NOTICE 'Generated timezone-aware task: % (%) for % %', 
                   template_record.title, new_task_id, next_due_date, next_due_time;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create task for template %: %', template_record.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;
  
  RAISE NOTICE 'Generated % overdue recurring tasks with proper timezone handling', generated_count;
  
  RETURN json_build_object(
    'generated', generated_count,
    'timestamp', NOW(),
    'success', true,
    'timezone', timezone_name
  );
END;
$$;

-- 3. Update the immediate generation function as well
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
  next_due_date DATE;
  next_due_time TIME;
  existing_task_id UUID;
  new_task_id UUID;
  timezone_name TEXT := 'Asia/Yerevan';
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
  
  -- Calculate next due date based on recurring pattern (DATE ONLY)
  CASE template_record.recurring_pattern
    WHEN 'daily' THEN
      next_due_date := (current_due_date AT TIME ZONE timezone_name)::DATE + INTERVAL '1 day';
    WHEN 'weekly' THEN
      next_due_date := (current_due_date AT TIME ZONE timezone_name)::DATE + INTERVAL '7 days';
    WHEN 'monthly' THEN
      next_due_date := (current_due_date AT TIME ZONE timezone_name)::DATE + INTERVAL '1 month';
    ELSE
      -- Unknown pattern, default to daily
      next_due_date := (current_due_date AT TIME ZONE timezone_name)::DATE + INTERVAL '1 day';
  END CASE;
  
  -- Extract time component from template (preserving the original time)
  IF template_record.recurring_time IS NOT NULL THEN
    next_due_time := template_record.recurring_time::TIME;
  ELSE
    -- Default to the same time as the current task
    next_due_time := (current_due_date AT TIME ZONE timezone_name)::TIME;
  END IF;
  
  -- Check if next instance already exists
  SELECT id INTO existing_task_id
  FROM public.tasks
  WHERE parent_task_id = template_id
    AND DATE(due_date AT TIME ZONE timezone_name) = next_due_date;
    
  IF existing_task_id IS NOT NULL THEN
    RETURN existing_task_id; -- Already exists
  END IF;
  
  -- Create new task instance using the timezone-aware helper function
  SELECT public.create_task_with_local_time(
    template_record.title,
    template_record.description,
    template_record.points,
    COALESCE(template_record.penalty_points, 0),
    next_due_date::TEXT, -- Date as string
    next_due_time::TEXT, -- Time as string
    template_record.assigned_to,
    template_record.created_by,
    template_record.family_id,
    COALESCE(template_record.task_type, 'non_negotiable'),
    COALESCE(template_record.transferable, false),
    template_id,
    template_record.recurring_pattern,
    timezone_name
  ) INTO new_task_id;
  
  RAISE NOTICE 'Generated timezone-aware next recurring task: % (%) for % %', 
               template_record.title, new_task_id, next_due_date, next_due_time;
  
  RETURN new_task_id;
END;
$$;

-- 4. Grant all necessary permissions
GRANT EXECUTE ON FUNCTION public.create_task_with_local_time TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_current_recurring_tasks() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.generate_next_recurring_task_immediate TO authenticated, anon, service_role;

-- 5. Test query to verify timezone handling
-- Uncomment the line below to test the function
-- SELECT public.ensure_current_recurring_tasks();
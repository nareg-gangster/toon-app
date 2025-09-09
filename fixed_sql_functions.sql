-- FIXED SQL FUNCTIONS - COPY THIS EXACTLY
-- Run this in Supabase SQL Editor (copy one function at a time)

-- 1. COMPREHENSIVE RECURRING TASK GENERATION (Daily, Weekly, Monthly)
CREATE OR REPLACE FUNCTION public.generate_all_recurring_tasks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template_record RECORD;
  target_date DATE := CURRENT_DATE;
  due_datetime TIMESTAMPTZ;
  next_due_date DATE;
  should_create_task BOOLEAN;
  daily_count INTEGER := 0;
  weekly_count INTEGER := 0;
  monthly_count INTEGER := 0;
  result jsonb;
BEGIN
  RAISE NOTICE 'Starting recurring task generation for %', target_date;
  
  -- Loop through ALL recurring templates (daily, weekly, monthly)
  FOR template_record IN 
    SELECT * FROM public.tasks 
    WHERE is_recurring = true 
      AND parent_task_id IS NULL 
      AND recurring_pattern IN ('daily', 'weekly', 'monthly')
      AND status IN ('pending', 'in_progress', 'approved')
  LOOP
    should_create_task := false;
    next_due_date := target_date;
    
    RAISE NOTICE 'Processing template: % (pattern: %)', template_record.title, template_record.recurring_pattern;
    
    -- Check if task already exists for calculated due date
    IF NOT EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE parent_task_id = template_record.id 
        AND DATE(due_date) = next_due_date
    ) THEN
      
      -- Determine if we should create a task based on pattern
      CASE template_record.recurring_pattern
        WHEN 'daily' THEN
          should_create_task := true;
          daily_count := daily_count + 1;
          
        WHEN 'weekly' THEN
          -- Check if it's been a week since last task or template creation
          -- If no tasks exist, create first one
          IF NOT EXISTS (
            SELECT 1 FROM public.tasks 
            WHERE parent_task_id = template_record.id
          ) THEN
            should_create_task := true; -- First weekly task
          ELSE
            -- Check if a week has passed since last task
            IF EXISTS (
              SELECT 1 FROM public.tasks 
              WHERE parent_task_id = template_record.id
                AND due_date < (target_date - INTERVAL '7 days')
                AND status IN ('approved', 'rejected')
            ) AND NOT EXISTS (
              SELECT 1 FROM public.tasks 
              WHERE parent_task_id = template_record.id
                AND due_date >= (target_date - INTERVAL '7 days')
            ) THEN
              should_create_task := true;
            END IF;
          END IF;
          
          IF should_create_task THEN
            weekly_count := weekly_count + 1;
          END IF;
          
        WHEN 'monthly' THEN
          -- Similar logic for monthly
          IF NOT EXISTS (
            SELECT 1 FROM public.tasks 
            WHERE parent_task_id = template_record.id
          ) THEN
            should_create_task := true; -- First monthly task
          ELSE
            -- Check if a month has passed since last task
            IF EXISTS (
              SELECT 1 FROM public.tasks 
              WHERE parent_task_id = template_record.id
                AND due_date < (target_date - INTERVAL '1 month')
                AND status IN ('approved', 'rejected')
            ) AND NOT EXISTS (
              SELECT 1 FROM public.tasks 
              WHERE parent_task_id = template_record.id
                AND due_date >= (target_date - INTERVAL '1 month')
            ) THEN
              should_create_task := true;
            END IF;
          END IF;
          
          IF should_create_task THEN
            monthly_count := monthly_count + 1;
          END IF;
      END CASE;
      
      -- Create the task if conditions are met
      IF should_create_task THEN
        -- Calculate due datetime
        due_datetime := next_due_date + COALESCE(template_record.recurring_time || ':00', '23:59:00')::TIME;
        
        -- Create new task instance
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
        
        RAISE NOTICE 'Created % task for % due at %', template_record.recurring_pattern, template_record.title, due_datetime;
      END IF;
    END IF;
  END LOOP;
  
  -- Return summary
  result := jsonb_build_object(
    'daily_tasks_created', daily_count,
    'weekly_tasks_created', weekly_count, 
    'monthly_tasks_created', monthly_count,
    'total_created', daily_count + weekly_count + monthly_count,
    'processed_date', target_date
  );
  
  RAISE NOTICE 'Task generation completed: %', result;
  RETURN result;
END;
$$;
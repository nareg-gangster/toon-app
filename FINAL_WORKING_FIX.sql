-- REVERT TO SIMPLE SQL FUNCTION - LET JAVASCRIPT HANDLE TIMEZONE
-- The key insight: JavaScript handles timezone correctly, SQL should be simple

CREATE OR REPLACE FUNCTION public.ensure_current_recurring_tasks()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  generated_count INTEGER := 0;
  task_record RECORD;
  template_record RECORD;
  next_due_timestamp TIMESTAMPTZ;
  existing_task_id UUID;
  new_task_id UUID;
BEGIN
  RAISE NOTICE 'Starting simple recurring task check...';
  
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
    
    -- Calculate next due timestamp based on pattern
    -- SIMPLIFIED: Just add intervals directly to preserve timezone
    CASE template_record.recurring_pattern
      WHEN 'daily' THEN
        next_due_timestamp := task_record.due_date + INTERVAL '1 day';
      WHEN 'weekly' THEN  
        next_due_timestamp := task_record.due_date + INTERVAL '7 days';
      WHEN 'monthly' THEN
        next_due_timestamp := task_record.due_date + INTERVAL '1 month';
      ELSE
        next_due_timestamp := task_record.due_date + INTERVAL '1 day';
    END CASE;
    
    -- Check if next instance already exists for this date
    SELECT id INTO existing_task_id
    FROM public.tasks
    WHERE parent_task_id = template_record.id
      AND DATE(due_date) = DATE(next_due_timestamp);
      
    IF existing_task_id IS NOT NULL THEN
      CONTINUE; -- Already exists
    END IF;
    
    -- Create new task instance - SIMPLE INSERT
    BEGIN
      INSERT INTO public.tasks (
        title, description, points, penalty_points, due_date,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, recurring_pattern, status
      ) VALUES (
        template_record.title,
        template_record.description,
        template_record.points,
        COALESCE(template_record.penalty_points, 0),
        next_due_timestamp, -- Use the calculated timestamp directly
        template_record.assigned_to,
        template_record.created_by,
        template_record.family_id,
        COALESCE(template_record.task_type, 'non_negotiable'),
        COALESCE(template_record.transferable, false),
        template_record.id,
        false, -- Instance is not recurring
        template_record.recurring_pattern, -- Inherit pattern for display
        'pending'
      ) RETURNING id INTO new_task_id;
      
      generated_count := generated_count + 1;
      RAISE NOTICE 'Generated task: % (%) for %', template_record.title, new_task_id, next_due_timestamp;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create task for template %: %', template_record.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;
  
  RAISE NOTICE 'Generated % overdue recurring tasks', generated_count;
  
  RETURN json_build_object(
    'generated', generated_count,
    'timestamp', NOW(),
    'success', true
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ensure_current_recurring_tasks() TO authenticated, anon, service_role;

-- Test the function
-- SELECT public.ensure_current_recurring_tasks();
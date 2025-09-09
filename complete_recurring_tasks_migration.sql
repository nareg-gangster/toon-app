-- COMPLETE SQL MIGRATION FOR RECURRING TASK DAY/DATE FUNCTIONALITY
-- Run this entire script in Supabase SQL Editor

-- =============================================================================
-- STEP 1: ADD NEW COLUMNS TO TASKS TABLE
-- =============================================================================

-- Add new fields for recurring task day/date selection
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS recurring_day_of_week integer, -- 0=Sunday, 1=Monday, ..., 6=Saturday (for weekly)
ADD COLUMN IF NOT EXISTS recurring_day_of_month integer; -- 1-31 (for monthly)

-- Add constraints to ensure valid values
ALTER TABLE public.tasks 
ADD CONSTRAINT check_recurring_day_of_week 
  CHECK (recurring_day_of_week IS NULL OR (recurring_day_of_week >= 0 AND recurring_day_of_week <= 6));

ALTER TABLE public.tasks 
ADD CONSTRAINT check_recurring_day_of_month 
  CHECK (recurring_day_of_month IS NULL OR (recurring_day_of_month >= 1 AND recurring_day_of_month <= 31));

-- Add helpful comments
COMMENT ON COLUMN public.tasks.recurring_day_of_week IS 'Day of week for weekly recurring tasks (0=Sunday, 1=Monday, ..., 6=Saturday)';
COMMENT ON COLUMN public.tasks.recurring_day_of_month IS 'Day of month for monthly recurring tasks (1-31)';

-- =============================================================================
-- STEP 2: UPDATE OR CREATE THE RECURRING TEMPLATES VIEW
-- =============================================================================

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

-- =============================================================================
-- STEP 3: CREATE/REPLACE ALL RECURRING TASK FUNCTIONS
-- =============================================================================

-- Enhanced Daily Recurring Tasks Function
CREATE OR REPLACE FUNCTION generate_daily_recurring_tasks()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    template_record RECORD;
    new_task_id UUID;
    tasks_created INTEGER := 0;
    current_date_with_time TIMESTAMP;
BEGIN
    -- Get all active daily recurring task templates
    FOR template_record IN
        SELECT * FROM public.tasks 
        WHERE is_recurring = true 
        AND recurring_pattern = 'daily'
        AND parent_task_id IS NULL
        AND status IN ('pending', 'in_progress')
    LOOP
        -- Calculate today's due date with the specified time
        current_date_with_time := CURRENT_DATE + (template_record.recurring_time || ':00')::TIME;
        
        -- Check if a task for today already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.tasks 
            WHERE parent_task_id = template_record.id 
            AND DATE(due_date) = CURRENT_DATE
        ) THEN
            -- Generate new task ID
            new_task_id := gen_random_uuid();
            
            -- Create today's instance
            INSERT INTO public.tasks (
                id, title, description, points, due_date, status,
                assigned_to, created_by, family_id, is_recurring,
                recurring_pattern, parent_task_id, penalty_points,
                task_type, transferable, original_assignee, 
                is_available_for_pickup, created_at
            ) VALUES (
                new_task_id,
                template_record.title,
                template_record.description,
                template_record.points,
                current_date_with_time,
                'pending',
                template_record.assigned_to,
                template_record.created_by,
                template_record.family_id,
                false, -- instances are not recurring
                template_record.recurring_pattern,
                template_record.id,
                template_record.penalty_points,
                template_record.task_type,
                template_record.transferable,
                CASE WHEN template_record.task_type = 'hanging' THEN NULL ELSE template_record.assigned_to END,
                CASE WHEN template_record.task_type = 'hanging' THEN true ELSE false END,
                NOW()
            );
            
            tasks_created := tasks_created + 1;
        END IF;
    END LOOP;
    
    RETURN 'Created ' || tasks_created || ' daily recurring tasks';
END;
$$;

-- Enhanced Weekly Recurring Tasks Function  
CREATE OR REPLACE FUNCTION generate_weekly_recurring_tasks()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    template_record RECORD;
    new_task_id UUID;
    tasks_created INTEGER := 0;
    target_date DATE;
    current_date_with_time TIMESTAMP;
    days_until_target INTEGER;
BEGIN
    -- Get all active weekly recurring task templates
    FOR template_record IN
        SELECT * FROM public.tasks 
        WHERE is_recurring = true 
        AND recurring_pattern = 'weekly'
        AND parent_task_id IS NULL
        AND status IN ('pending', 'in_progress')
        AND recurring_day_of_week IS NOT NULL
    LOOP
        -- Calculate days until the target day of week
        days_until_target := (template_record.recurring_day_of_week - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER + 7) % 7;
        
        -- If it's 0, it means today is the target day
        IF days_until_target = 0 THEN
            target_date := CURRENT_DATE;
        ELSE
            target_date := CURRENT_DATE + days_until_target;
        END IF;
        
        -- Calculate target datetime with specified time
        current_date_with_time := target_date + (template_record.recurring_time || ':00')::TIME;
        
        -- Check if a task for this week already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.tasks 
            WHERE parent_task_id = template_record.id 
            AND DATE(due_date) = target_date
        ) THEN
            -- Generate new task ID
            new_task_id := gen_random_uuid();
            
            -- Create this week's instance
            INSERT INTO public.tasks (
                id, title, description, points, due_date, status,
                assigned_to, created_by, family_id, is_recurring,
                recurring_pattern, parent_task_id, penalty_points,
                task_type, transferable, original_assignee,
                is_available_for_pickup, created_at
            ) VALUES (
                new_task_id,
                template_record.title,
                template_record.description,
                template_record.points,
                current_date_with_time,
                'pending',
                template_record.assigned_to,
                template_record.created_by,
                template_record.family_id,
                false, -- instances are not recurring
                template_record.recurring_pattern,
                template_record.id,
                template_record.penalty_points,
                template_record.task_type,
                template_record.transferable,
                CASE WHEN template_record.task_type = 'hanging' THEN NULL ELSE template_record.assigned_to END,
                CASE WHEN template_record.task_type = 'hanging' THEN true ELSE false END,
                NOW()
            );
            
            tasks_created := tasks_created + 1;
        END IF;
    END LOOP;
    
    RETURN 'Created ' || tasks_created || ' weekly recurring tasks';
END;
$$;

-- Enhanced Monthly Recurring Tasks Function
CREATE OR REPLACE FUNCTION generate_monthly_recurring_tasks()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    template_record RECORD;
    new_task_id UUID;
    tasks_created INTEGER := 0;
    target_date DATE;
    current_date_with_time TIMESTAMP;
    current_month INTEGER;
    current_year INTEGER;
    target_day INTEGER;
    days_in_current_month INTEGER;
BEGIN
    -- Get current month and year
    current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    
    -- Get all active monthly recurring task templates
    FOR template_record IN
        SELECT * FROM public.tasks 
        WHERE is_recurring = true 
        AND recurring_pattern = 'monthly'
        AND parent_task_id IS NULL
        AND status IN ('pending', 'in_progress')
        AND recurring_day_of_month IS NOT NULL
    LOOP
        target_day := template_record.recurring_day_of_month;
        
        -- Get days in current month
        days_in_current_month := EXTRACT(DAYS FROM DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::INTEGER;
        
        -- Adjust target day if it exceeds days in current month (e.g., Feb 30th -> Feb 28th)
        IF target_day > days_in_current_month THEN
            target_day := days_in_current_month;
        END IF;
        
        -- Create target date
        target_date := make_date(current_year, current_month, target_day);
        
        -- If the target date has passed this month, move to next month
        IF target_date < CURRENT_DATE THEN
            -- Move to next month
            IF current_month = 12 THEN
                current_month := 1;
                current_year := current_year + 1;
            ELSE
                current_month := current_month + 1;
            END IF;
            
            -- Recalculate for next month
            days_in_current_month := EXTRACT(DAYS FROM make_date(current_year, current_month, 1) + INTERVAL '1 month - 1 day')::INTEGER;
            
            IF template_record.recurring_day_of_month > days_in_current_month THEN
                target_day := days_in_current_month;
            ELSE
                target_day := template_record.recurring_day_of_month;
            END IF;
            
            target_date := make_date(current_year, current_month, target_day);
        END IF;
        
        -- Calculate target datetime with specified time
        current_date_with_time := target_date + (template_record.recurring_time || ':00')::TIME;
        
        -- Check if a task for this month already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.tasks 
            WHERE parent_task_id = template_record.id 
            AND DATE(due_date) = target_date
        ) THEN
            -- Generate new task ID
            new_task_id := gen_random_uuid();
            
            -- Create this month's instance
            INSERT INTO public.tasks (
                id, title, description, points, due_date, status,
                assigned_to, created_by, family_id, is_recurring,
                recurring_pattern, parent_task_id, penalty_points,
                task_type, transferable, original_assignee,
                is_available_for_pickup, created_at
            ) VALUES (
                new_task_id,
                template_record.title,
                template_record.description,
                template_record.points,
                current_date_with_time,
                'pending',
                template_record.assigned_to,
                template_record.created_by,
                template_record.family_id,
                false, -- instances are not recurring
                template_record.recurring_pattern,
                template_record.id,
                template_record.penalty_points,
                template_record.task_type,
                template_record.transferable,
                CASE WHEN template_record.task_type = 'hanging' THEN NULL ELSE template_record.assigned_to END,
                CASE WHEN template_record.task_type = 'hanging' THEN true ELSE false END,
                NOW()
            );
            
            tasks_created := tasks_created + 1;
        END IF;
    END LOOP;
    
    RETURN 'Created ' || tasks_created || ' monthly recurring tasks';
END;
$$;

-- Master function that calls all recurring task generators
CREATE OR REPLACE FUNCTION generate_all_recurring_tasks()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    daily_result TEXT;
    weekly_result TEXT;
    monthly_result TEXT;
    total_created INTEGER := 0;
BEGIN
    -- Generate daily tasks
    SELECT generate_daily_recurring_tasks() INTO daily_result;
    
    -- Generate weekly tasks
    SELECT generate_weekly_recurring_tasks() INTO weekly_result;
    
    -- Generate monthly tasks  
    SELECT generate_monthly_recurring_tasks() INTO monthly_result;
    
    -- Extract numbers for total count
    total_created := 
        COALESCE(CAST(regexp_replace(daily_result, '[^0-9]', '', 'g') AS INTEGER), 0) +
        COALESCE(CAST(regexp_replace(weekly_result, '[^0-9]', '', 'g') AS INTEGER), 0) +
        COALESCE(CAST(regexp_replace(monthly_result, '[^0-9]', '', 'g') AS INTEGER), 0);
    
    RETURN json_build_object(
        'success', true,
        'total_created', total_created,
        'daily_result', daily_result,
        'weekly_result', weekly_result,
        'monthly_result', monthly_result,
        'timestamp', NOW()
    );
END;
$$;

-- Enhanced penalty processing function
CREATE OR REPLACE FUNCTION process_overdue_penalties()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    task_record RECORD;
    penalties_applied INTEGER := 0;
BEGIN
    -- Find all overdue tasks with penalties that haven't been processed
    FOR task_record IN
        SELECT t.*, u.points as current_points
        FROM public.tasks t
        LEFT JOIN public.users u ON t.assigned_to = u.id
        WHERE t.due_date < NOW()
        AND t.status IN ('pending', 'in_progress')
        AND t.penalty_points > 0
        AND t.assigned_to IS NOT NULL
        AND t.assigned_to != ''
    LOOP
        -- Apply penalty by reducing user's points
        UPDATE public.users 
        SET points = GREATEST(0, points - task_record.penalty_points)
        WHERE id = task_record.assigned_to;
        
        -- Mark task as archived with penalty applied
        UPDATE public.tasks
        SET 
            status = 'archived',
            archived_at = NOW(),
            rejection_reason = 'Overdue penalty applied: -' || task_record.penalty_points || ' points'
        WHERE id = task_record.id;
        
        penalties_applied := penalties_applied + 1;
    END LOOP;
    
    RETURN penalties_applied;
END;
$$;

-- =============================================================================
-- STEP 4: GRANT NECESSARY PERMISSIONS (if needed)
-- =============================================================================

-- Grant execute permissions to authenticated users (adjust as needed for your RLS setup)
GRANT EXECUTE ON FUNCTION generate_daily_recurring_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_weekly_recurring_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_monthly_recurring_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_all_recurring_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION process_overdue_penalties() TO authenticated;

-- Grant select permissions on the view
GRANT SELECT ON public.active_recurring_templates TO authenticated;

-- =============================================================================
-- VERIFICATION QUERIES (Optional - for testing)
-- =============================================================================

-- You can uncomment and run these to test the functions:

-- Test the master function
-- SELECT generate_all_recurring_tasks();

-- Check the new columns exist
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'tasks' 
-- AND column_name IN ('recurring_day_of_week', 'recurring_day_of_month');

-- Check existing recurring templates
-- SELECT id, title, recurring_pattern, recurring_day_of_week, recurring_day_of_month 
-- FROM public.tasks 
-- WHERE is_recurring = true AND parent_task_id IS NULL;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- This migration adds:
-- 1. New columns: recurring_day_of_week, recurring_day_of_month
-- 2. Proper constraints and comments
-- 3. Enhanced SQL functions for smart task generation
-- 4. Updated view for recurring templates
-- 5. Penalty processing function

-- Your recurring tasks will now support:
-- - Weekly tasks on specific days (Monday, Tuesday, etc.)
-- - Monthly tasks on specific dates (1st, 15th, etc.) 
-- - Smart date handling (Feb 30th -> Feb 28th)
-- - Automated task generation via Edge Functions
-- UPDATE DAILY TASK CREATION TO AVOID PAST DUE TIMES
-- Run this in Supabase SQL Editor

-- Enhanced Daily Recurring Tasks Function with time checking
CREATE OR REPLACE FUNCTION generate_daily_recurring_tasks()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    template_record RECORD;
    new_task_id UUID;
    tasks_created INTEGER := 0;
    target_date DATE;
    current_date_with_time TIMESTAMP;
    target_time_today TIMESTAMP;
BEGIN
    -- Get all active daily recurring task templates
    FOR template_record IN
        SELECT * FROM public.tasks 
        WHERE is_recurring = true 
        AND recurring_pattern = 'daily'
        AND parent_task_id IS NULL
        AND status IN ('pending', 'in_progress')
    LOOP
        -- Check if the deadline time has already passed today
        target_time_today := CURRENT_DATE + (template_record.recurring_time || ':00')::TIME;
        
        IF target_time_today <= NOW() THEN
            -- Time has passed today, schedule for tomorrow
            target_date := CURRENT_DATE + INTERVAL '1 day';
        ELSE
            -- Time hasn't passed yet, schedule for today
            target_date := CURRENT_DATE;
        END IF;
        
        -- Calculate target datetime
        current_date_with_time := target_date + (template_record.recurring_time || ':00')::TIME;
        
        -- Check if a task for the target date already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.tasks 
            WHERE parent_task_id = template_record.id 
            AND DATE(due_date) = target_date
        ) THEN
            -- Generate new task ID
            new_task_id := gen_random_uuid();
            
            -- Create the instance
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
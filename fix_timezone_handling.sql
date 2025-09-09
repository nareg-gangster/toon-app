-- Fix timezone handling for recurring tasks
-- This addresses the issue where 21:20 Armenia time becomes 01:20 due to UTC conversion

-- Option 1: Create a helper function to insert tasks with correct timezone handling
CREATE OR REPLACE FUNCTION insert_task_with_local_time(
    p_title TEXT,
    p_description TEXT,
    p_points INTEGER,
    p_penalty_points INTEGER,
    p_due_date_string TEXT,
    p_due_time TEXT,
    p_assigned_to UUID,
    p_created_by UUID,
    p_family_id UUID,
    p_task_type TEXT,
    p_transferable BOOLEAN,
    p_parent_task_id UUID,
    p_is_recurring BOOLEAN,
    p_recurring_pattern TEXT,
    p_status TEXT,
    p_is_strict BOOLEAN,
    p_timezone TEXT DEFAULT 'Asia/Yerevan'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    new_task_id UUID;
    local_datetime TIMESTAMPTZ;
BEGIN
    -- Create the datetime in the specified timezone
    -- This explicitly tells PostgreSQL the timezone context
    local_datetime := (p_due_date_string || ' ' || p_due_time || ':00')::TIMESTAMP AT TIME ZONE p_timezone;
    
    -- Generate new task ID
    new_task_id := gen_random_uuid();
    
    -- Insert the task
    INSERT INTO tasks (
        id, title, description, points, penalty_points, due_date,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, recurring_pattern, status, is_strict
    ) VALUES (
        new_task_id, p_title, p_description, p_points, p_penalty_points, local_datetime,
        p_assigned_to, p_created_by, p_family_id, p_task_type, p_transferable,
        p_parent_task_id, p_is_recurring, p_recurring_pattern, p_status, p_is_strict
    );
    
    RETURN new_task_id;
END;
$$;

-- Option 2: Alternative approach - modify the due_date column type
-- WARNING: This is a more drastic change that affects the entire schema
-- Uncomment only if you want to try changing the column type

-- ALTER TABLE tasks ALTER COLUMN due_date TYPE TIMESTAMP;
-- COMMENT ON COLUMN tasks.due_date IS 'Local timestamp without timezone conversion';

-- Option 3: Add a separate time storage column for recurring tasks
-- This keeps the original due_date as timestamptz but adds explicit time tracking

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS local_due_time TIME,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Yerevan';

COMMENT ON COLUMN tasks.local_due_time IS 'The intended local time for the task deadline';
COMMENT ON COLUMN tasks.timezone IS 'The timezone this task was created in';

-- Create an updated function that uses the new columns
CREATE OR REPLACE FUNCTION insert_recurring_task_with_timezone(
    p_title TEXT,
    p_description TEXT,
    p_points INTEGER,
    p_penalty_points INTEGER,
    p_due_date_string TEXT,
    p_due_time TEXT,
    p_assigned_to UUID,
    p_created_by UUID,
    p_family_id UUID,
    p_task_type TEXT,
    p_transferable BOOLEAN,
    p_parent_task_id UUID,
    p_recurring_pattern TEXT,
    p_timezone TEXT DEFAULT 'Asia/Yerevan'
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    description TEXT,
    points INTEGER,
    penalty_points INTEGER,
    due_date TIMESTAMPTZ,
    local_due_time TIME,
    timezone TEXT,
    assigned_to UUID,
    created_by UUID,
    family_id UUID,
    task_type TEXT,
    transferable BOOLEAN,
    parent_task_id UUID,
    is_recurring BOOLEAN,
    recurring_pattern TEXT,
    status TEXT,
    is_strict BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    new_task_id UUID;
    local_datetime TIMESTAMPTZ;
    time_only TIME;
BEGIN
    -- Parse the time
    time_only := p_due_time::TIME;
    
    -- Create the datetime in the specified timezone
    local_datetime := (p_due_date_string || ' ' || p_due_time || ':00')::TIMESTAMP AT TIME ZONE p_timezone;
    
    -- Generate new task ID
    new_task_id := gen_random_uuid();
    
    -- Insert the task with both timestamptz and separate time tracking
    INSERT INTO tasks (
        id, title, description, points, penalty_points, due_date, local_due_time, timezone,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, recurring_pattern, status, is_strict
    ) VALUES (
        new_task_id, p_title, p_description, p_points, p_penalty_points, local_datetime, time_only, p_timezone,
        p_assigned_to, p_created_by, p_family_id, p_task_type, p_transferable,
        p_parent_task_id, false, p_recurring_pattern, 'pending', false
    );
    
    -- Return the inserted task
    RETURN QUERY
    SELECT t.id, t.title, t.description, t.points, t.penalty_points, t.due_date, t.local_due_time, t.timezone,
           t.assigned_to, t.created_by, t.family_id, t.task_type, t.transferable,
           t.parent_task_id, t.is_recurring, t.recurring_pattern, t.status, t.is_strict, t.created_at
    FROM tasks t
    WHERE t.id = new_task_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION insert_task_with_local_time TO authenticated;
GRANT EXECUTE ON FUNCTION insert_recurring_task_with_timezone TO authenticated;
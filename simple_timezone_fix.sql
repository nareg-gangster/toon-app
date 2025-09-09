-- Simple fix: Create a function that bypasses PostgreSQL's timezone conversion entirely
-- This uses TIMESTAMP (without timezone) to avoid any automatic conversion

CREATE OR REPLACE FUNCTION insert_task_simple_time(
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
    p_recurring_pattern TEXT
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    description TEXT,
    points INTEGER,
    penalty_points INTEGER,
    due_date TIMESTAMPTZ,
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
    simple_datetime TIMESTAMP;
    final_datetime TIMESTAMPTZ;
BEGIN
    -- Create a simple TIMESTAMP (no timezone) first
    simple_datetime := (p_due_date_string || ' ' || p_due_time || ':00')::TIMESTAMP;
    
    -- Convert to TIMESTAMPTZ by explicitly stating it's in Armenia timezone
    final_datetime := simple_datetime AT TIME ZONE 'Asia/Yerevan';
    
    -- Generate new task ID
    new_task_id := gen_random_uuid();
    
    -- Insert the task
    INSERT INTO tasks (
        id, title, description, points, penalty_points, due_date,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, recurring_pattern, status, is_strict
    ) VALUES (
        new_task_id, p_title, p_description, p_points, p_penalty_points, final_datetime,
        p_assigned_to, p_created_by, p_family_id, p_task_type, p_transferable,
        p_parent_task_id, false, p_recurring_pattern, 'pending', false
    );
    
    -- Return the inserted task
    RETURN QUERY
    SELECT t.id, t.title, t.description, t.points, t.penalty_points, t.due_date,
           t.assigned_to, t.created_by, t.family_id, t.task_type, t.transferable,
           t.parent_task_id, t.is_recurring, t.recurring_pattern, t.status, t.is_strict, t.created_at
    FROM tasks t
    WHERE t.id = new_task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_task_simple_time TO authenticated;
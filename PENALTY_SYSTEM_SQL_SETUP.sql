-- ============================================================================
-- PENALTY SYSTEM SQL SETUP - Execute in Supabase SQL Editor
-- ============================================================================

-- 1. VERIFY DATABASE SCHEMA (should already exist from your schema)
-- The following fields should already exist in your tasks table:
-- - penalized_at: timestamp with time zone (for tracking when penalty was applied)
-- - penalty_points: integer (for penalty amount)
-- - due_date: timestamp with time zone (for deadline checking)

-- If you need to add these fields (unlikely since they're in your schema):
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS penalized_at timestamp with time zone;
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS penalty_points integer DEFAULT 0;

-- ============================================================================
-- 2. SUPABASE DATABASE FUNCTIONS (for edge function/cron job support)
-- ============================================================================

-- Function to process overdue penalties (used by cron job)
CREATE OR REPLACE FUNCTION process_overdue_penalties()
RETURNS integer
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
  penalty_count integer := 0;
  task_record record;
  current_points integer;
  new_points integer;
BEGIN
  -- Find overdue tasks that haven't been penalized yet
  FOR task_record IN 
    SELECT t.*, u.points as user_points
    FROM tasks t
    JOIN users u ON t.assigned_to = u.id
    WHERE t.due_date < NOW()
    AND t.penalized_at IS NULL
    AND t.penalty_points > 0
    AND t.status NOT IN ('approved', 'archived')
  LOOP
    -- Calculate new points (can't go below 0)
    current_points := COALESCE(task_record.user_points, 0);
    new_points := GREATEST(0, current_points - task_record.penalty_points);
    
    -- Update user points
    UPDATE users 
    SET points = new_points 
    WHERE id = task_record.assigned_to;
    
    -- Mark task as penalized
    UPDATE tasks 
    SET penalized_at = NOW()
    WHERE id = task_record.id;
    
    -- Generate next recurring task if applicable
    IF task_record.parent_task_id IS NOT NULL THEN
      PERFORM generate_next_recurring_task(task_record.parent_task_id, task_record.due_date);
    END IF;
    
    penalty_count := penalty_count + 1;
    
    -- Log the penalty (optional)
    RAISE NOTICE 'Applied % penalty points to user % for task: %', 
                 task_record.penalty_points, task_record.assigned_to, task_record.title;
  END LOOP;
  
  RETURN penalty_count;
END;
$$;

-- Function to generate next recurring task instance
CREATE OR REPLACE FUNCTION generate_next_recurring_task(
  template_id uuid,
  last_due_date timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
  template_record record;
  next_due_date timestamp with time zone;
  hours integer;
  minutes integer;
BEGIN
  -- Get the template
  SELECT * INTO template_record
  FROM tasks
  WHERE id = template_id
  AND is_recurring = true;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate next due date based on recurring pattern
  CASE template_record.recurring_pattern
    WHEN 'daily' THEN
      next_due_date := last_due_date + INTERVAL '1 day';
    WHEN 'weekly' THEN
      next_due_date := last_due_date + INTERVAL '7 days';
    WHEN 'monthly' THEN
      next_due_date := last_due_date + INTERVAL '1 month';
    ELSE
      RETURN; -- Unknown pattern
  END CASE;
  
  -- Check if task already exists for this date
  IF EXISTS (
    SELECT 1 FROM tasks 
    WHERE parent_task_id = template_id
    AND DATE(due_date) = DATE(next_due_date)
  ) THEN
    RETURN; -- Task already exists
  END IF;
  
  -- Create the new task instance
  INSERT INTO tasks (
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
    template_record.penalty_points,
    next_due_date,
    template_record.assigned_to,
    template_record.created_by,
    template_record.family_id,
    template_record.task_type,
    template_record.transferable,
    template_id,
    false, -- Instance is not recurring
    'pending'
  );
  
  RAISE NOTICE 'Generated next recurring task: % for %', template_record.title, next_due_date;
END;
$$;

-- Function to generate all recurring tasks (daily, weekly, monthly)
CREATE OR REPLACE FUNCTION generate_all_recurring_tasks()
RETURNS json
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
  daily_count integer := 0;
  weekly_count integer := 0;
  monthly_count integer := 0;
  task_record record;
  target_date timestamp with time zone;
  result json;
BEGIN
  -- Process daily recurring tasks
  FOR task_record IN 
    SELECT * FROM tasks
    WHERE is_recurring = true
    AND parent_task_id IS NULL
    AND recurring_pattern = 'daily'
    AND status IN ('pending', 'in_progress', 'approved')
    AND (is_recurring_enabled IS NULL OR is_recurring_enabled = true)
  LOOP
    target_date := CURRENT_DATE;
    
    -- Check if today's deadline has passed
    IF task_record.recurring_time IS NOT NULL THEN
      target_date := target_date + task_record.recurring_time::time;
      IF target_date <= NOW() THEN
        target_date := target_date + INTERVAL '1 day';
      END IF;
    END IF;
    
    -- Generate task if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM tasks 
      WHERE parent_task_id = task_record.id
      AND DATE(due_date) = DATE(target_date)
    ) THEN
      INSERT INTO tasks (
        title, description, points, penalty_points, due_date,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, status
      ) VALUES (
        task_record.title, task_record.description, task_record.points,
        task_record.penalty_points, target_date, task_record.assigned_to,
        task_record.created_by, task_record.family_id, task_record.task_type,
        task_record.transferable, task_record.id, false, 'pending'
      );
      daily_count := daily_count + 1;
    END IF;
  END LOOP;
  
  -- Process weekly recurring tasks
  FOR task_record IN 
    SELECT * FROM tasks
    WHERE is_recurring = true
    AND parent_task_id IS NULL
    AND recurring_pattern = 'weekly'
    AND status IN ('pending', 'in_progress', 'approved')
    AND (is_recurring_enabled IS NULL OR is_recurring_enabled = true)
  LOOP
    -- Calculate next occurrence of target weekday
    target_date := date_trunc('week', CURRENT_DATE) + 
                   (COALESCE(task_record.recurring_day_of_week, 1) || ' days')::interval;
    
    IF task_record.recurring_time IS NOT NULL THEN
      target_date := target_date + task_record.recurring_time::time;
    END IF;
    
    -- If target date has passed, move to next week
    IF target_date <= NOW() THEN
      target_date := target_date + INTERVAL '1 week';
    END IF;
    
    -- Generate task if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM tasks 
      WHERE parent_task_id = task_record.id
      AND DATE(due_date) = DATE(target_date)
    ) THEN
      INSERT INTO tasks (
        title, description, points, penalty_points, due_date,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, status
      ) VALUES (
        task_record.title, task_record.description, task_record.points,
        task_record.penalty_points, target_date, task_record.assigned_to,
        task_record.created_by, task_record.family_id, task_record.task_type,
        task_record.transferable, task_record.id, false, 'pending'
      );
      weekly_count := weekly_count + 1;
    END IF;
  END LOOP;
  
  -- Process monthly recurring tasks
  FOR task_record IN 
    SELECT * FROM tasks
    WHERE is_recurring = true
    AND parent_task_id IS NULL
    AND recurring_pattern = 'monthly'
    AND status IN ('pending', 'in_progress', 'approved')
    AND (is_recurring_enabled IS NULL OR is_recurring_enabled = true)
  LOOP
    -- Calculate target date this month
    target_date := date_trunc('month', CURRENT_DATE) + 
                   (COALESCE(task_record.recurring_day_of_month, 1) - 1 || ' days')::interval;
    
    IF task_record.recurring_time IS NOT NULL THEN
      target_date := target_date + task_record.recurring_time::time;
    END IF;
    
    -- If target date has passed this month, move to next month
    IF target_date <= NOW() THEN
      target_date := date_trunc('month', CURRENT_DATE + INTERVAL '1 month') + 
                     (COALESCE(task_record.recurring_day_of_month, 1) - 1 || ' days')::interval;
      IF task_record.recurring_time IS NOT NULL THEN
        target_date := target_date + task_record.recurring_time::time;
      END IF;
    END IF;
    
    -- Generate task if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM tasks 
      WHERE parent_task_id = task_record.id
      AND DATE(due_date) = DATE(target_date)
    ) THEN
      INSERT INTO tasks (
        title, description, points, penalty_points, due_date,
        assigned_to, created_by, family_id, task_type, transferable,
        parent_task_id, is_recurring, status
      ) VALUES (
        task_record.title, task_record.description, task_record.points,
        task_record.penalty_points, target_date, task_record.assigned_to,
        task_record.created_by, task_record.family_id, task_record.task_type,
        task_record.transferable, task_record.id, false, 'pending'
      );
      monthly_count := monthly_count + 1;
    END IF;
  END LOOP;
  
  -- Return result
  result := json_build_object(
    'daily', daily_count,
    'weekly', weekly_count, 
    'monthly', monthly_count,
    'total', daily_count + weekly_count + monthly_count
  );
  
  RETURN result;
END;
$$;

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE (important for large datasets)
-- ============================================================================

-- Index for overdue task checking
CREATE INDEX IF NOT EXISTS idx_tasks_overdue_check 
ON tasks (due_date, penalized_at, penalty_points) 
WHERE penalized_at IS NULL AND penalty_points > 0;

-- Index for recurring task generation
CREATE INDEX IF NOT EXISTS idx_tasks_recurring_templates 
ON tasks (is_recurring, parent_task_id, recurring_pattern, status) 
WHERE is_recurring = true AND parent_task_id IS NULL;

-- Index for task instance checking
CREATE INDEX IF NOT EXISTS idx_tasks_instances 
ON tasks (parent_task_id, due_date) 
WHERE parent_task_id IS NOT NULL;

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view penalties on their tasks" ON tasks;
DROP POLICY IF EXISTS "Service role can update penalty status" ON tasks;
DROP POLICY IF EXISTS "Service role can update user points" ON users;

-- Allow users to see penalties on their own tasks
CREATE POLICY "Users can view penalties on their tasks" ON tasks
FOR SELECT USING (assigned_to = auth.uid());

-- Allow system to update penalty status (for service role)
CREATE POLICY "Service role can update penalty status" ON tasks
FOR UPDATE USING (true) WITH CHECK (true);

-- Allow system to update user points (for service role)  
CREATE POLICY "Service role can update user points" ON users
FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. OPTIONAL: MANUAL TEST QUERIES
-- ============================================================================

-- Test query: Find all overdue tasks
-- SELECT t.title, t.due_date, t.penalty_points, t.penalized_at, u.name as assigned_to_name
-- FROM tasks t
-- JOIN users u ON t.assigned_to = u.id
-- WHERE t.due_date < NOW()
-- AND t.penalized_at IS NULL
-- AND t.penalty_points > 0;

-- Test query: Process penalties manually
-- SELECT process_overdue_penalties();

-- Test query: Generate recurring tasks manually
-- SELECT generate_all_recurring_tasks();

-- ============================================================================
-- EXECUTION INSTRUCTIONS:
-- ============================================================================
-- 1. Copy and paste this entire SQL into Supabase SQL Editor
-- 2. Execute it (click Run)
-- 3. Set up your cron job/edge function to call these functions periodically
-- 4. Test with your application
-- ============================================================================
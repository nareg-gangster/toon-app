-- FIX PENALTY LOGIC - Run this to update penalty functions
-- The issue was that completed tasks were being penalized even after the child submitted them

-- Update the penalty processing function
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
  
  -- Only penalize tasks that are still pending or in_progress
  -- DO NOT penalize completed tasks (child has submitted them on time)
  FOR overdue_record IN 
    SELECT t.*, u.points as current_points, u.name as user_name
    FROM public.tasks t
    JOIN public.users u ON t.assigned_to = u.id
    WHERE t.due_date < NOW()
      AND t.status IN ('pending', 'in_progress')  -- FIXED: Exclude 'completed' status
      AND t.penalty_points > 0
      AND t.penalized_at IS NULL
      AND (t.is_recurring = false OR t.parent_task_id IS NOT NULL)
  LOOP
    -- Deduct penalty points
    UPDATE public.users 
    SET points = GREATEST(0, points - overdue_record.penalty_points)
    WHERE id = overdue_record.assigned_to;
    
    -- Mark task as penalized and rejected
    UPDATE public.tasks 
    SET penalized_at = NOW(),
        status = 'rejected',
        rejection_reason = COALESCE(rejection_reason, '') || ' [PENALTY: -' || overdue_record.penalty_points || ' points]'
    WHERE id = overdue_record.id;
    
    penalty_count := penalty_count + 1;
    RAISE NOTICE 'Applied penalty to task: % for user: %', overdue_record.title, overdue_record.user_name;
  END LOOP;
  
  RAISE NOTICE 'Penalty processing complete. Applied % penalties.', penalty_count;
  RETURN penalty_count;
END;
$$;

-- Comment explaining the fix
-- A task is considered to have met the deadline when the CHILD submits it (status = 'completed')
-- NOT when the parent approves it (status = 'approved')
-- The penalty system now correctly only penalizes tasks that are still 'pending' or 'in_progress'
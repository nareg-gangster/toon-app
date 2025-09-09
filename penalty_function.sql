-- PENALTY PROCESSING FUNCTION - COPY THIS SEPARATELY
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
  
  FOR overdue_record IN 
    SELECT t.*, u.points as current_points, u.name as user_name
    FROM public.tasks t
    JOIN public.users u ON t.assigned_to = u.id
    WHERE t.due_date < NOW()
      AND t.status IN ('pending', 'in_progress')  -- Only pending/in_progress, NOT completed
      AND t.penalty_points > 0
      AND t.penalized_at IS NULL
      AND (t.is_recurring = false OR t.parent_task_id IS NOT NULL)
  LOOP
    UPDATE public.users 
    SET points = GREATEST(0, points - overdue_record.penalty_points)
    WHERE id = overdue_record.assigned_to;
    
    UPDATE public.tasks 
    SET penalized_at = NOW(),
        status = 'rejected',
        rejection_reason = COALESCE(rejection_reason, '') || ' [PENALTY: -' || overdue_record.penalty_points || ' points]'
    WHERE id = overdue_record.id;
    
    penalty_count := penalty_count + 1;
  END LOOP;
  
  RETURN penalty_count;
END;
$$;
-- Fix RLS policies for views to make them secure
-- Run this in Supabase SQL Editor

-- Drop existing views and recreate them with proper security
DROP VIEW IF EXISTS public.active_recurring_templates;
DROP VIEW IF EXISTS public.overdue_tasks_with_penalties;  
DROP VIEW IF EXISTS public.available_hanging_tasks;

-- Create secure views with RLS by using security definer functions instead

-- 1. Create function to get active recurring templates
CREATE OR REPLACE FUNCTION get_active_recurring_templates(family_uuid uuid)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  points integer,
  recurring_pattern text,
  recurring_time text,
  penalty_points integer,
  task_type text,
  assigned_to uuid,
  assigned_user_name text,
  family_id uuid,
  created_at timestamptz
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user has access to this family
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.family_id = family_uuid
  ) THEN
    RAISE EXCEPTION 'Access denied to family data';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.description,
    t.points,
    t.recurring_pattern,
    t.recurring_time,
    t.penalty_points,
    t.task_type,
    t.assigned_to,
    u.name as assigned_user_name,
    t.family_id,
    t.created_at
  FROM public.tasks t
  LEFT JOIN public.users u ON t.assigned_to = u.id
  WHERE t.is_recurring = true 
    AND t.status = 'approved'
    AND t.family_id = family_uuid;
END;
$$;

-- 2. Create function to get available hanging tasks  
CREATE OR REPLACE FUNCTION get_available_hanging_tasks(family_uuid uuid)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  points integer,
  penalty_points integer,
  due_date timestamptz,
  created_by_name text,
  family_id uuid,
  created_at timestamptz
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user has access to this family
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.family_id = family_uuid
  ) THEN
    RAISE EXCEPTION 'Access denied to family data';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.description,
    t.points,
    t.penalty_points,
    t.due_date,
    creator.name as created_by_name,
    t.family_id,
    t.created_at
  FROM public.tasks t
  JOIN public.users creator ON t.created_by = creator.id
  WHERE t.task_type = 'hanging'
    AND t.is_available_for_pickup = true
    AND t.status = 'pending'
    AND (t.is_recurring = false OR t.parent_task_id IS NOT NULL)
    AND t.family_id = family_uuid;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_active_recurring_templates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_hanging_tasks(uuid) TO authenticated;

-- Update your Edge Function code to use these functions instead of direct table access
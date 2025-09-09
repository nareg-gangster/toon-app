-- DEBUG QUERIES TO UNDERSTAND WHY NO RECURRING TASKS ARE GENERATED

-- 1. Check all recurring task templates
SELECT 
    id,
    title,
    recurring_pattern,
    recurring_time,
    status,
    is_recurring,
    parent_task_id,
    created_at
FROM public.tasks 
WHERE is_recurring = true 
ORDER BY created_at DESC;

-- 2. Check all recurring task instances (children of templates)
SELECT 
    t.id,
    t.title,
    t.due_date,
    t.status,
    t.parent_task_id,
    t.is_recurring,
    template.title as template_title,
    template.recurring_pattern
FROM public.tasks t
JOIN public.tasks template ON t.parent_task_id = template.id
WHERE t.parent_task_id IS NOT NULL
ORDER BY t.due_date DESC;

-- 3. Check for overdue recurring instances that should trigger new tasks
SELECT 
    t.id,
    t.title,
    t.due_date,
    t.status,
    t.parent_task_id,
    template.title as template_title,
    template.recurring_pattern,
    template.recurring_time,
    CASE 
        WHEN t.due_date < NOW() THEN 'OVERDUE'
        ELSE 'NOT DUE YET'
    END as overdue_status
FROM public.tasks t
JOIN public.tasks template ON t.parent_task_id = template.id
WHERE t.parent_task_id IS NOT NULL
  AND t.status != 'archived'
ORDER BY t.due_date DESC;

-- 4. Check what the function thinks it should process
SELECT DISTINCT t.parent_task_id, t.due_date
FROM public.tasks t
WHERE t.parent_task_id IS NOT NULL  -- Only recurring instances
  AND t.due_date < NOW()           -- Past deadline
  AND t.status != 'archived'      -- Not archived
  AND NOT EXISTS (
    -- Don't process if there's already a newer instance
    SELECT 1 FROM public.tasks newer
    WHERE newer.parent_task_id = t.parent_task_id
      AND newer.due_date > t.due_date
      AND newer.due_date >= DATE_TRUNC('day', NOW())
  );
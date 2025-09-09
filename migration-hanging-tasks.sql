-- Migration to convert existing hanging tasks to new structure
-- Run this SQL in your Supabase database

-- 1. First, add the new columns if they don't exist
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_hanging BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hanging_expires_at TIMESTAMPTZ;

-- 2. Update existing hanging tasks to use new structure
UPDATE tasks 
SET 
  is_hanging = TRUE,
  task_type = 'non_negotiable',  -- Convert to hanging + non_negotiable as requested
  transferable = FALSE,
  hanging_expires_at = NOW() + INTERVAL '7 days'  -- Set default 7 days expiration
WHERE task_type = 'hanging';

-- 3. Update task_type enum to remove 'hanging' option (optional - run after testing)
-- This step should be done after confirming everything works
-- ALTER TYPE task_type_enum DROP VALUE 'hanging';

-- 4. Create index for performance on hanging task queries
CREATE INDEX IF NOT EXISTS idx_tasks_hanging_expires 
ON tasks (is_hanging, hanging_expires_at) 
WHERE is_hanging = TRUE;

-- 5. Create index for hanging tasks pickup queries  
CREATE INDEX IF NOT EXISTS idx_tasks_hanging_pickup 
ON tasks (family_id, is_hanging, is_available_for_pickup, status) 
WHERE is_hanging = TRUE;
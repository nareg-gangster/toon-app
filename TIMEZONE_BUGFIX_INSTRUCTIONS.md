# TIMEZONE BUGFIX - Recurring Tasks Armenia Time Issue

## Problem Description
When creating recurring tasks in Armenia (UTC+4), the deadline times were being shifted by 4 hours. For example:
- Parent sets deadline: 18:39 Armenia time
- First task created correctly: 18:39
- Second recurring task created: 22:39 (4 hours later!)

## Root Cause
The issue was in the SQL functions handling recurring task generation. PostgreSQL was treating time arithmetic operations without proper timezone context, causing UTC conversions instead of preserving local time.

## Solution Applied

### 1. New SQL Functions (`TIMEZONE_FIX_FINAL.sql`)
- **`create_task_with_local_time()`**: Helper function that properly handles timezone-aware task creation
- **Updated `ensure_current_recurring_tasks()`**: Now uses explicit Armenia timezone handling
- **Updated `generate_next_recurring_task_immediate()`**: Timezone-aware immediate generation

### 2. Updated JavaScript Service (`src/services/recurringTasksService.ts`)
- Modified `generateTaskForDate()` to use the new SQL function instead of direct inserts
- Proper timezone handling via `p_timezone: 'Asia/Yerevan'` parameter

## Implementation Steps

### Step 1: Apply SQL Changes
Run the following SQL in your Supabase SQL Editor:
```sql
-- Copy and paste the entire content of TIMEZONE_FIX_FINAL.sql
```

### Step 2: Code Changes Already Applied
The JavaScript service has been updated to use the new timezone-aware SQL functions.

## Testing Instructions

### Test 1: Create New Recurring Task
1. Go to parent dashboard
2. Create a new daily recurring task
3. Set deadline to 18:39 (or any specific time)
4. Verify the first task is created with correct time (18:39)
5. Wait for the deadline to pass or manually trigger the check
6. Verify the second recurring task is created with the SAME time (18:39, not 22:39)

### Test 2: Verify Existing Tasks
1. Check existing overdue recurring tasks
2. Manually trigger the check: call `/api/recurring-tasks/check-overdue`
3. Verify new instances are created with preserved original times

### Test 3: API Testing
```bash
# Test the function directly in Supabase SQL editor:
SELECT public.ensure_current_recurring_tasks();

# Should return JSON with generated count and success: true
```

## Expected Behavior After Fix
- ✅ Parent creates recurring task at 18:39 Armenia time
- ✅ First instance created: 18:39 Armenia time  
- ✅ Second instance created: 18:39 Armenia time (NOT 22:39)
- ✅ All subsequent instances: 18:39 Armenia time
- ✅ Time only changes if parent manually edits the recurring task template

## Key Changes Made

### SQL Level
- Explicit timezone handling using `AT TIME ZONE 'Asia/Yerevan'`
- Separate date and time handling to prevent conversion errors
- Helper function `create_task_with_local_time()` for consistent task creation

### JavaScript Level  
- Replaced direct task inserts with RPC calls to timezone-aware SQL functions
- Proper parameter passing for timezone context
- Enhanced debugging logs

## Files Modified
1. ✅ `TIMEZONE_FIX_FINAL.sql` - New timezone-aware SQL functions
2. ✅ `src/services/recurringTasksService.ts` - Updated to use new SQL functions
3. ✅ `TIMEZONE_BUGFIX_INSTRUCTIONS.md` - This documentation

## Rollback Plan (if needed)
If issues arise, you can revert by:
1. Rolling back the `recurringTasksService.ts` changes
2. Using the old SQL functions from `simple_recurring_check.sql`

However, the new implementation is more robust and should be kept.
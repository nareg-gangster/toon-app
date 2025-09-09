import { useEffect, useRef } from 'react'

interface UseRecurringTaskCheckOptions {
  enabled?: boolean
  onTasksGenerated?: (count: number) => void
  refetchTasks?: () => Promise<void> | void
}

/**
 * Hook that checks for overdue recurring tasks and generates new ones immediately
 * This ensures tasks appear as soon as deadlines pass, not waiting for cron jobs
 */
export function useRecurringTaskCheck(options: UseRecurringTaskCheckOptions = {}) {
  const { enabled = true, onTasksGenerated, refetchTasks } = options
  const checkInProgress = useRef(false)
  const lastCheck = useRef<number>(0)

  const checkOverdueTasks = async () => {
    console.log('🔍 RECURRING CHECK: checkOverdueTasks called')
    
    // Prevent multiple simultaneous checks
    if (checkInProgress.current) {
      console.log('⏭️ RECURRING CHECK: Already in progress, skipping')
      return
    }
    
    // Rate limiting: don't check more than once per minute
    const now = Date.now()
    if (now - lastCheck.current < 60000) {
      console.log('⏭️ RECURRING CHECK: Rate limited, skipping')
      return
    }
    
    console.log('🔄 RECURRING CHECK: Starting check...')
    checkInProgress.current = true
    lastCheck.current = now
    
    try {
      const response = await fetch('/api/recurring-tasks/check-overdue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const generatedCount = data.result?.generated || 0
        
        console.log('✅ RECURRING CHECK: API response:', data)
        console.log('🔢 RECURRING CHECK: Generated count:', generatedCount)
        
        if (generatedCount > 0) {
          console.log(`✨ RECURRING CHECK: Generated ${generatedCount} overdue recurring tasks`)
          onTasksGenerated?.(generatedCount)
          
          // Refresh tasks list instead of hard page reload
          console.log('🔄 RECURRING CHECK: Calling refetchTasks...')
          if (refetchTasks) {
            await refetchTasks()
            console.log('✅ RECURRING CHECK: refetchTasks completed')
          } else {
            // Fallback to page reload if no refetch function provided
            window.location.reload()
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('❌ Failed to check overdue tasks:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
      }
    } catch (error) {
      console.error('❌ Error checking overdue tasks:', error)
    } finally {
      checkInProgress.current = false
    }
  }

  useEffect(() => {
    if (!enabled) {
      console.log('🚫 RECURRING CHECK: Hook disabled')
      return
    }

    console.log('🚀 RECURRING CHECK: Hook enabled, setting up triggers')

    // Check immediately on mount
    console.log('🔄 RECURRING CHECK: Triggering immediate check on mount')
    checkOverdueTasks()

    // Check when window gains focus (user returns to app)
    const handleFocus = () => {
      console.log('👁️ RECURRING CHECK: Window focus detected, triggering check')
      checkOverdueTasks()
    }

    // Check periodically (every 5 minutes as backup)
    const interval = setInterval(() => {
      console.log('⏰ RECURRING CHECK: Periodic check triggered (5min interval)')
      checkOverdueTasks()
    }, 5 * 60 * 1000)

    window.addEventListener('focus', handleFocus)

    return () => {
      console.log('🧹 RECURRING CHECK: Cleaning up event listeners and interval')
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [enabled])

  return {
    checkOverdueTasks
  }
}
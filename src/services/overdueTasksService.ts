import { supabase } from '@/lib/supabase'
import { Task } from '@/types'

export const overdueTasksService = {
  /**
   * Check for overdue tasks and apply penalties immediately (client-side)
   * This runs when a user loads their tasks to provide instant feedback
   */
  async checkAndProcessOverdueTasks(tasks: Task[]): Promise<{
    processedTasks: Task[],
    penaltiesApplied: number
  }> {
    const now = new Date()
    const overdueTasks: Task[] = []
    let penaltiesApplied = 0

    // Find tasks that are overdue and haven't been penalized yet
    for (const task of tasks) {
      if (this.isTaskOverdue(task, now) && !task.penalized_at && task.penalty_points > 0) {
        overdueTasks.push(task)
        console.log(`🔍 Found overdue task for client-side penalty: ${task.title} (due: ${task.due_date})`)
      }
    }

    if (overdueTasks.length === 0) {
      return { processedTasks: tasks, penaltiesApplied: 0 }
    }

    // Process each overdue task individually
    const processedTasks = [...tasks]
    
    for (const task of overdueTasks) {
      try {
        await this.applyPenaltyToTask(task)
        
        // Update the task in our local array
        const taskIndex = processedTasks.findIndex(t => t.id === task.id)
        if (taskIndex !== -1) {
          processedTasks[taskIndex] = {
            ...processedTasks[taskIndex],
            penalized_at: now.toISOString()
          }
        }
        
        penaltiesApplied++
        console.log(`⚡ Applied ${task.penalty_points} penalty for overdue task: ${task.title}`)
        
        // Generate next recurring task if applicable
        if (task.parent_task_id) {
          await this.generateNextRecurringTaskAfterPenalty(task)
        }
      } catch (error) {
        console.error(`Error applying penalty to task ${task.id}:`, error)
      }
    }

    return { processedTasks, penaltiesApplied }
  },

  /**
   * Check if a task is overdue
   * A task is overdue only if it's past deadline AND the child hasn't completed it yet
   */
  isTaskOverdue(task: Task, now?: Date): boolean {
    if (!task.due_date) return false
    
    const currentTime = now || new Date()
    const dueDate = new Date(task.due_date)
    
    // Task is overdue only if:
    // 1. Past the due date
    // 2. Child hasn't completed it yet (status is still pending or in_progress)
    // 3. Hasn't been penalized already
    return dueDate < currentTime && 
           ['pending', 'in_progress'].includes(task.status) && 
           !task.penalized_at
  },

  /**
   * Apply penalty to a specific task
   */
  async applyPenaltyToTask(task: Task): Promise<void> {
    if (!task.assigned_to || !task.penalty_points) return

    // Get current user points
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('points')
      .eq('id', task.assigned_to)
      .single()

    if (userError) {
      console.error('Error fetching user points:', userError)
      throw userError
    }

    // Calculate new points (can't go below 0)
    const currentPoints = userData?.points || 0
    const newPoints = Math.max(0, currentPoints - task.penalty_points)

    // Update user points and mark task as penalized in parallel
    const [pointsUpdate, taskUpdate] = await Promise.all([
      supabase
        .from('users')
        .update({ points: newPoints })
        .eq('id', task.assigned_to),
      
      supabase
        .from('tasks')
        .update({ 
          penalized_at: new Date().toISOString()
          // Note: Don't change status here - keep it as is for resubmission
        })
        .eq('id', task.id)
    ])

    if (pointsUpdate.error) {
      console.error('Error updating user points:', pointsUpdate.error)
      throw pointsUpdate.error
    }

    if (taskUpdate.error) {
      console.error('Error marking task as penalized:', taskUpdate.error)
      throw taskUpdate.error
    }
  },

  /**
   * Generate next recurring task after penalty is applied
   */
  async generateNextRecurringTaskAfterPenalty(task: Task): Promise<void> {
    if (!task.parent_task_id || !task.due_date) return

    try {
      // Get the parent template
      const { data: parentTemplate, error: templateError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', task.parent_task_id)
        .single()

      if (templateError || !parentTemplate) {
        console.error('Error fetching recurring template:', templateError)
        return
      }

      // Import recurring service dynamically to avoid circular dependency
      const { recurringTasksService } = await import('./recurringTasksService')
      await recurringTasksService.generateNextRecurringInstance(parentTemplate, task.due_date)
      
      console.log(`🔄 Generated next recurring instance after penalty: ${parentTemplate.title}`)
    } catch (error) {
      console.error('Error generating next recurring instance:', error)
    }
  },

  /**
   * Get overdue status for a task (for UI display)
   */
  getTaskOverdueStatus(task: Task): {
    isOverdue: boolean
    isPenalized: boolean
    canResubmitWithoutPenalty: boolean
    statusMessage: string
  } {
    const now = new Date()
    const isOverdue = this.isTaskOverdue(task, now)
    const isPenalized = !!task.penalized_at
    const isRejectedAfterDeadline = task.status === 'rejected' && task.due_date && new Date(task.due_date) < now

    let statusMessage = ''
    let canResubmitWithoutPenalty = false

    if (isRejectedAfterDeadline && isPenalized) {
      statusMessage = 'Resubmit (no additional penalty - parent reviewed late)'
      canResubmitWithoutPenalty = true
    } else if (isPenalized) {
      statusMessage = 'Task overdue - penalty points already applied'
    } else if (isOverdue) {
      statusMessage = 'Task is overdue - penalty points will be applied'
    }

    return {
      isOverdue: isOverdue || isPenalized,
      isPenalized,
      canResubmitWithoutPenalty,
      statusMessage
    }
  }
}
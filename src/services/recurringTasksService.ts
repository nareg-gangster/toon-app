import { supabase } from '@/lib/supabase'
import { Task } from '@/types'

export const recurringTasksService = {
  /**
   * Generate ALL recurring tasks (daily, weekly, monthly)
   * This should be run regularly (could be via cron job or API route)
   */
  async generateAllRecurringTasks(): Promise<{daily: number, weekly: number, monthly: number}> {
    console.log('🔄 Starting all recurring tasks generation...')
    
    try {
      // Get all recurring task templates (only enabled ones)
      const { data: recurringTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_recurring', true)
        .is('parent_task_id', null) // Only templates (not instances)
        .in('recurring_pattern', ['daily', 'weekly', 'monthly'])
        .in('status', ['pending', 'in_progress', 'approved']) // Active templates
        .neq('is_recurring_enabled', false) // Only enabled recurring tasks
      
      if (fetchError) {
        console.error('Error fetching recurring tasks:', fetchError)
        throw fetchError
      }

      if (!recurringTasks || recurringTasks.length === 0) {
        console.log('No recurring tasks found')
        return { daily: 0, weekly: 0, monthly: 0 }
      }

      const today = new Date()
      let dailyGenerated = 0, weeklyGenerated = 0, monthlyGenerated = 0

      for (const template of recurringTasks) {
        const generated = await this.generateTaskForDate(template, today)
        if (generated) {
          switch (template.recurring_pattern) {
            case 'daily': dailyGenerated++; break;
            case 'weekly': weeklyGenerated++; break;
            case 'monthly': monthlyGenerated++; break;
          }
        }
      }

      console.log(`✅ Generated recurring tasks - Daily: ${dailyGenerated}, Weekly: ${weeklyGenerated}, Monthly: ${monthlyGenerated}`)
      return { daily: dailyGenerated, weekly: weeklyGenerated, monthly: monthlyGenerated }
    } catch (error) {
      console.error('❌ Error generating recurring tasks:', error)
      throw error
    }
  },

  /**
   * Generate daily tasks from recurring task templates
   * This should be run daily (could be via cron job or API route)
   */
  async generateDailyTasks(): Promise<void> {
    console.log('🔄 Starting daily task generation...')
    
    try {
      // Get all recurring task templates (including pending ones, only enabled)
      const { data: recurringTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_recurring', true)
        .is('parent_task_id', null) // Only templates (not instances)
        .in('recurring_pattern', ['daily'])
        .in('status', ['pending', 'in_progress', 'approved']) // Active templates
        .neq('is_recurring_enabled', false) // Only enabled recurring tasks
      
      if (fetchError) {
        console.error('Error fetching recurring tasks:', fetchError)
        throw fetchError
      }

      if (!recurringTasks || recurringTasks.length === 0) {
        console.log('No daily recurring tasks found')
        return
      }

      const today = new Date()
      const todayDateString = today.toISOString().split('T')[0]

      for (const template of recurringTasks) {
        await this.generateTaskForDate(template, today)
      }

      console.log(`✅ Generated ${recurringTasks.length} daily tasks for ${todayDateString}`)
    } catch (error) {
      console.error('❌ Error generating daily tasks:', error)
      throw error
    }
  },

  /**
   * Generate a single task instance from a recurring template
   */
  async generateTaskForDate(template: Task, targetDate: Date): Promise<Task | null> {
    // Calculate the next appropriate date based on recurring pattern
    const nextDate = this.calculateNextRecurringDate(template, targetDate)
    const dateString = nextDate.toISOString().split('T')[0]
    
    // Check if task already exists for this date range
    const { data: existingTask } = await supabase
      .from('tasks')
      .select('id')
      .eq('parent_task_id', template.id)
      .gte('due_date', dateString)
      .lt('due_date', dateString + 'T23:59:59')
      .single()

    if (existingTask) {
      console.log(`Task already exists for ${template.title} on ${dateString}`)
      return null
    }

    // TIMEZONE FIX: Use JavaScript Date object like createFirstRecurringInstance does
    // This ensures consistent timezone handling between first and subsequent tasks
    const timeString = template.recurring_time || '23:59'
    const [hours, minutes] = timeString.split(':').map(Number)
    
    // Create a proper Date object in local timezone
    const dueDate = new Date(nextDate)
    dueDate.setHours(hours, minutes, 0, 0)
    const dueDateTime = dueDate.toISOString()
    
    console.log('🔍 TIMEZONE FIX DEBUG:', { 
      templateId: template.id,
      templateTitle: template.title,
      templateRecurringTime: template.recurring_time,
      targetDate: dateString,
      calculatedDueDate: dueDate.toLocaleString(),
      finalDateTime: dueDateTime,
      isTemplate: template.is_recurring,
      parentTaskId: template.parent_task_id
    })

    // Use direct insert with properly constructed JavaScript Date
    console.log('🚀 Using JavaScript Date object like createFirstRecurringInstance')
    
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        title: template.title,
        description: template.description,
        points: template.points,
        penalty_points: template.penalty_points || 0,
        due_date: dueDateTime,
        assigned_to: template.assigned_to,
        created_by: template.created_by,
        family_id: template.family_id,
        task_type: template.task_type || 'non_negotiable',
        transferable: template.transferable || false,
        parent_task_id: template.id,
        is_recurring: false, // The instance is not recurring
        recurring_pattern: template.recurring_pattern, // Inherit pattern for display
        status: 'pending',
        is_strict: template.is_strict || false // Inherit strict setting
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating recurring task instance:', error)
      throw error
    }

    // Log what actually got stored in the database
    console.log('🔍 STORED TASK DEBUG:', {
      taskId: newTask.id,
      storedDueDate: newTask.due_date,
      originalTime: template.recurring_time,
      expectedDate: dateString,
      inputDateTime: dueDateTime,
      storedAsDate: new Date(newTask.due_date).toISOString(),
      storedLocalTime: new Date(newTask.due_date).toLocaleTimeString()
    })

    console.log(`✅ Generated ${template.recurring_pattern} task: ${template.title} for ${dateString}`)
    return newTask
  },

  /**
   * Generate next recurring task instance after a penalty or completion
   */
  async generateNextRecurringInstance(template: Task, lastDueDate: string): Promise<Task | null> {
    // Calculate next date based on the last due date
    const lastDate = new Date(lastDueDate)
    const nextDate = this.calculateNextRecurringDate(template, lastDate, true) // true = after penalty/completion
    
    return this.generateTaskForDate(template, nextDate)
  },

  /**
   * Calculate the next appropriate date for a recurring task
   */
  calculateNextRecurringDate(template: Task, fromDate: Date, afterCompletion: boolean = false): Date {
    const baseDate = new Date(fromDate)
    let nextDate = new Date(baseDate)

    switch (template.recurring_pattern) {
      case 'daily':
        if (afterCompletion) {
          // After completion/penalty, schedule for next day
          nextDate.setDate(baseDate.getDate() + 1)
        } else {
          // Initial generation - check if today's deadline has passed
          const now = new Date()
          const todayWithDeadline = new Date(now) // Use current date, not baseDate
          
          if (template.recurring_time) {
            const [hours, minutes] = template.recurring_time.split(':').map(Number)
            todayWithDeadline.setHours(hours, minutes, 0, 0)
          }
          
          if (todayWithDeadline <= now) {
            // Today's deadline has already passed, schedule for tomorrow
            nextDate = new Date(now)
            nextDate.setDate(now.getDate() + 1)
          } else {
            // Today's deadline hasn't passed yet, schedule for today
            nextDate = new Date(now)
          }
        }
        break

      case 'weekly':
        const targetWeekDay = template.recurring_day_of_week || 1
        if (afterCompletion) {
          // Schedule for next week's target day
          nextDate.setDate(baseDate.getDate() + 7)
        } else {
          // Find next occurrence of target day
          const currentWeekDay = baseDate.getDay()
          const daysUntilTarget = (targetWeekDay - currentWeekDay + 7) % 7
          
          if (daysUntilTarget === 0 && afterCompletion) {
            // Same day but after completion, go to next week
            nextDate.setDate(baseDate.getDate() + 7)
          } else {
            nextDate.setDate(baseDate.getDate() + (daysUntilTarget || 7))
          }
        }
        break

      case 'monthly':
        const targetMonthDay = template.recurring_day_of_month || 1
        if (afterCompletion) {
          // Move to next month
          nextDate.setMonth(baseDate.getMonth() + 1, targetMonthDay)
        } else {
          // Find next occurrence of target day
          nextDate.setDate(targetMonthDay)
          
          // If the date has passed this month, move to next month
          if (nextDate <= baseDate) {
            nextDate.setMonth(baseDate.getMonth() + 1, targetMonthDay)
          }
        }
        
        // Handle month overflow (e.g., Feb 30th -> Feb 28th)
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
        if (targetMonthDay > lastDayOfMonth) {
          nextDate.setDate(lastDayOfMonth)
        }
        break

      default:
        // Fallback to daily
        nextDate.setDate(baseDate.getDate() + 1)
    }

    return nextDate
  },

  /**
   * Generate next recurring task instances when deadlines pass
   * This should be run regularly (e.g., every hour) to check for overdue recurring tasks
   */
  async generateOverdueRecurringTasks(): Promise<{generated: number}> {
    console.log('🔄 Checking for overdue recurring tasks that need next instances...')
    
    try {
      const now = new Date()
      let tasksGenerated = 0
      
      // Get all overdue recurring task instances that don't have a next instance yet
      const { data: overdueTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .not('parent_task_id', 'is', null) // Only recurring instances (not templates)
        .lt('due_date', now.toISOString()) // Past deadline
        .neq('status', 'archived') // Not archived
      
      if (fetchError) {
        console.error('Error fetching overdue recurring tasks:', fetchError)
        throw fetchError
      }

      if (!overdueTasks || overdueTasks.length === 0) {
        console.log('No overdue recurring tasks found')
        return { generated: 0 }
      }

      // Group by template to avoid multiple instances for same template
      const processedTemplates = new Set<string>()

      for (const overdueTask of overdueTasks) {
        // Skip if we already processed this template
        if (processedTemplates.has(overdueTask.parent_task_id)) {
          continue
        }
        
        // Get the template
        const { data: template, error: templateError } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', overdueTask.parent_task_id)
          .single()

        if (templateError || !template) {
          console.error(`Error fetching template for overdue task ${overdueTask.id}:`, templateError)
          continue
        }
        
        // Skip if the recurring template is disabled
        if (template.is_recurring_enabled === false) {
          console.log(`Skipping overdue task ${overdueTask.id} - template ${template.title} is disabled`)
          processedTemplates.add(overdueTask.parent_task_id)
          continue
        }

        // Check if next instance already exists
        const nextDate = this.calculateNextRecurringDate(template, new Date(overdueTask.due_date), true)
        const nextDateString = nextDate.toISOString().split('T')[0]
        
        const { data: existingNextTask } = await supabase
          .from('tasks')
          .select('id')
          .eq('parent_task_id', template.id)
          .gte('due_date', nextDateString)
          .lt('due_date', nextDateString + 'T23:59:59')
          .single()

        if (existingNextTask) {
          console.log(`Next instance already exists for ${template.title}`)
          processedTemplates.add(overdueTask.parent_task_id)
          continue
        }

        // Generate next instance
        const generated = await this.generateNextRecurringInstance(template, overdueTask.due_date)
        if (generated) {
          tasksGenerated++
          console.log(`✅ Generated next recurring instance: ${template.title}`)
        }
        
        processedTemplates.add(overdueTask.parent_task_id)
      }

      console.log(`✅ Generated ${tasksGenerated} new recurring task instances`)
      return { generated: tasksGenerated }
    } catch (error) {
      console.error('❌ Error generating overdue recurring tasks:', error)
      throw error
    }
  },

  /**
   * Check for overdue tasks and apply penalties
   */
  async processPenalties(): Promise<void> {
    console.log('🔄 Processing penalties for overdue tasks...')
    
    try {
      // First, generate next instances for overdue recurring tasks
      await this.generateOverdueRecurringTasks()
      
      const now = new Date()
      
      // Get all overdue tasks that haven't been penalized yet
      const { data: overdueTasks, error: fetchError } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_user:users!tasks_assigned_to_fkey(id, name, points)
        `)
        .lt('due_date', now.toISOString())
        .neq('status', 'approved')
        .neq('status', 'archived')
        .gt('penalty_points', 0)
        .is('penalized_at', null) // Only tasks that haven't been penalized

      if (fetchError) {
        console.error('Error fetching overdue tasks:', fetchError)
        throw fetchError
      }

      if (!overdueTasks || overdueTasks.length === 0) {
        console.log('No overdue tasks requiring penalties found')
        return
      }

      let penaltiesApplied = 0
      
      for (const task of overdueTasks) {
        // Apply penalty to user's points
        const currentPoints = task.assigned_user?.points || 0
        const newPoints = Math.max(0, currentPoints - task.penalty_points)
        
        // Update user points
        const { error: pointsError } = await supabase
          .from('users')
          .update({ points: newPoints })
          .eq('id', task.assigned_to)

        if (pointsError) {
          console.error(`Error updating points for user ${task.assigned_to}:`, pointsError)
          continue
        }

        // Mark task as penalized
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ 
            penalized_at: now.toISOString(),
            status: 'rejected' // Mark as rejected due to penalty
          })
          .eq('id', task.id)

        if (taskError) {
          console.error(`Error marking task ${task.id} as penalized:`, taskError)
          continue
        }

        penaltiesApplied++
        console.log(`⚡ Applied ${task.penalty_points} penalty to ${task.assigned_user?.name} for "${task.title}"`)
      }

      console.log(`✅ Applied penalties to ${penaltiesApplied} overdue tasks`)
    } catch (error) {
      console.error('❌ Error processing penalties:', error)
      throw error
    }
  },

  /**
   * Validate if recurring task would create first instance (removed 30-minute buffer)
   */
  validateRecurringTaskTiming(taskData: {
    recurring_pattern: 'daily' | 'weekly' | 'monthly'
    recurring_time: string
    recurring_day_of_week?: number
    recurring_day_of_month?: number
  }): { isValid: boolean; nextTaskTime?: Date; errorMessage?: string } {
    const now = new Date()
    const [hours, minutes] = taskData.recurring_time.split(':').map(Number)
    
    let immediateNextTaskTime: Date // The very next occurrence, without auto-skipping
    
    switch (taskData.recurring_pattern) {
      case 'daily':
        const targetTimeToday = new Date()
        targetTimeToday.setHours(hours, minutes, 0, 0)
        
        if (targetTimeToday > now) {
          // Today's time hasn't passed yet
          immediateNextTaskTime = targetTimeToday
        } else {
          // Today's time has passed, next is tomorrow
          immediateNextTaskTime = new Date()
          immediateNextTaskTime.setDate(immediateNextTaskTime.getDate() + 1)
          immediateNextTaskTime.setHours(hours, minutes, 0, 0)
        }
        break
        
      case 'weekly':
        if (taskData.recurring_day_of_week !== null && taskData.recurring_day_of_week !== undefined) {
          const currentDay = now.getDay()
          const targetDay = taskData.recurring_day_of_week
          let daysUntilTarget = (targetDay - currentDay + 7) % 7
          
          // If it's the same day, check if time has passed
          if (daysUntilTarget === 0) {
            const targetTimeToday = new Date()
            targetTimeToday.setHours(hours, minutes, 0, 0)
            
            if (targetTimeToday > now) {
              // Today's target time hasn't passed yet
              immediateNextTaskTime = targetTimeToday
            } else {
              // Today's target time has passed, next week
              immediateNextTaskTime = new Date()
              immediateNextTaskTime.setDate(immediateNextTaskTime.getDate() + 7)
              immediateNextTaskTime.setHours(hours, minutes, 0, 0)
            }
          } else {
            // Target day is later this week
            immediateNextTaskTime = new Date()
            immediateNextTaskTime.setDate(immediateNextTaskTime.getDate() + daysUntilTarget)
            immediateNextTaskTime.setHours(hours, minutes, 0, 0)
          }
        } else {
          return { 
            isValid: false, 
            errorMessage: 'Weekly recurring tasks must specify a day of the week' 
          }
        }
        break
        
      case 'monthly':
        if (taskData.recurring_day_of_month !== null && taskData.recurring_day_of_month !== undefined) {
          const currentMonth = now.getMonth()
          const currentYear = now.getFullYear()
          const targetDay = taskData.recurring_day_of_month
          
          const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
          const actualTargetDay = Math.min(targetDay, lastDayOfMonth)
          
          const targetDateThisMonth = new Date(currentYear, currentMonth, actualTargetDay)
          targetDateThisMonth.setHours(hours, minutes, 0, 0)
          
          if (targetDateThisMonth > now) {
            // This month's target hasn't passed yet
            immediateNextTaskTime = targetDateThisMonth
          } else {
            // This month's target has passed, next month
            const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
            const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
            
            const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate()
            const nextActualTargetDay = Math.min(targetDay, lastDayOfNextMonth)
            
            immediateNextTaskTime = new Date(nextYear, nextMonth, nextActualTargetDay)
            immediateNextTaskTime.setHours(hours, minutes, 0, 0)
          }
        } else {
          return { 
            isValid: false, 
            errorMessage: 'Monthly recurring tasks must specify a day of the month' 
          }
        }
        break
        
      default:
        return { 
          isValid: false, 
          errorMessage: 'Invalid recurring pattern' 
        }
    }
    
    // CRITICAL: Check if the first task instance would be at least 30 minutes in the future
    // This prevents creating recurring tasks that would immediately generate overdue instances
    const minFutureTime = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes from now
    
    if (immediateNextTaskTime <= minFutureTime) {
      const timeUntilNext = Math.round((immediateNextTaskTime.getTime() - now.getTime()) / (1000 * 60))
      const patternText = taskData.recurring_pattern === 'daily' ? 'daily' : 
                         taskData.recurring_pattern === 'weekly' ? 'weekly' : 'monthly'
      
      return {
        isValid: false,
        nextTaskTime: immediateNextTaskTime,
        errorMessage: `The first recurring task would be due in ${timeUntilNext} minute${timeUntilNext !== 1 ? 's' : ''}. Recurring tasks must be scheduled at least 30 minutes in advance.`
      }
    }
    
    return { isValid: true, nextTaskTime: immediateNextTaskTime }
  },

  /**
   * Create a new recurring task template
   */
  async createRecurringTask(taskData: {
    title: string
    description?: string
    points: number
    penalty_points: number
    recurring_pattern: 'daily' | 'weekly' | 'monthly'
    recurring_time: string // HH:mm format
    recurring_days?: string[] // For weekly/monthly patterns
    recurring_day_of_week?: number // For weekly
    recurring_day_of_month?: number // For monthly
    assigned_to: string
    created_by: string
    family_id: string
    task_type?: 'negotiable' | 'non_negotiable' | 'hanging'
  }): Promise<Task> {
    
    // Validate timing before creating
    const validation = this.validateRecurringTaskTiming({
      recurring_pattern: taskData.recurring_pattern,
      recurring_time: taskData.recurring_time,
      recurring_day_of_week: taskData.recurring_day_of_week,
      recurring_day_of_month: taskData.recurring_day_of_month
    })
    
    if (!validation.isValid) {
      throw new Error(validation.errorMessage)
    }
    
    const { data: template, error } = await supabase
      .from('tasks')
      .insert({
        title: taskData.title,
        description: taskData.description || null,
        points: taskData.points,
        penalty_points: taskData.penalty_points,
        assigned_to: taskData.assigned_to,
        created_by: taskData.created_by,
        family_id: taskData.family_id,
        is_recurring: true,
        recurring_pattern: taskData.recurring_pattern,
        recurring_time: taskData.recurring_time,
        recurring_days: taskData.recurring_days || null,
        task_type: taskData.task_type || 'non_negotiable',
        transferable: taskData.task_type === 'negotiable',
        status: 'approved', // Templates start approved
        due_date: null // Templates don't have specific due dates
      })
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url)
      `)
      .single()

    if (error) throw error
    return template
  },

  /**
   * Get all recurring task templates for a family
   */
  async getRecurringTasks(familyId: string): Promise<Task[]> {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url)
      `)
      .eq('family_id', familyId)
      .eq('is_recurring', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return tasks || []
  },

  /**
   * Update a recurring task template
   */
  async updateRecurringTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('is_recurring', true)
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url)
      `)
      .single()

    if (error) throw error
    return updatedTask
  },

  /**
   * Delete a recurring task template (this will not affect already generated instances)
   */
  async deleteRecurringTask(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('is_recurring', true)

    if (error) throw error
  }
}
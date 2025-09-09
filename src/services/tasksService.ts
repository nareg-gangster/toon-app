import { supabase } from '@/lib/supabase'
import { Task, CreateTaskData, TaskCompletionData, TaskFilters } from '@/types'
import { notificationTriggers } from '@/services/notificationTriggers'

export const tasksService = {
  async getTasks(familyId: string, filters?: TaskFilters): Promise<Task[]> {
    console.log('🔍 TASKS SERVICE: getTasks called for familyId:', familyId, 'with filters:', filters)
    
    // This method is for PARENTS - should show templates AND instances
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url),
        task_completions(*)
      `)
      .eq('family_id', familyId)

    // Apply filters
    if (filters) {
      // Status filter
      if (filters.status !== 'all') {
        if (filters.status === 'active') {
          query = query.in('status', ['pending', 'in_progress', 'completed'])
        } else {
          query = query.eq('status', filters.status)
        }
      }

      // Child filter (for parents)
      if (filters.assignedTo !== 'all') {
        query = query.eq('assigned_to', filters.assignedTo)
      }

      // Due date filter
      if (filters.dueDate !== 'all') {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

        switch (filters.dueDate) {
          case 'overdue':
            query = query.lt('due_date', today.toISOString())
            break
          case 'today':
            query = query.gte('due_date', today.toISOString()).lt('due_date', tomorrow.toISOString())
            break
          case 'thisWeek':
            query = query.gte('due_date', today.toISOString()).lt('due_date', nextWeek.toISOString())
            break
          case 'noDueDate':
            query = query.is('due_date', null)
            break
        }
      }

      // Archive filter
      if (!filters.showArchived) {
        query = query.neq('status', 'archived')
      }

      // Task type filter (recurring vs one-time)
      if (filters.taskType !== 'all') {
        if (filters.taskType === 'recurring') {
          // Show recurring templates OR instances from recurring templates
          query = query.or('is_recurring.eq.true,parent_task_id.not.is.null')
        } else if (filters.taskType === 'one-time') {
          // Show one-time tasks (not recurring and no parent)
          query = query.and('is_recurring.eq.false,parent_task_id.is.null')
        }
      } else {
        // FIXED: Prevent "duplicate" appearance of template + instance
        // Show recurring templates OR one-time tasks OR instances needing review
        // But prioritize instances over templates (don't show both)
        query = query.or('and(is_recurring.eq.true,parent_task_id.is.null),and(is_recurring.eq.false,parent_task_id.is.null),and(parent_task_id.not.is.null,status.in.(pending,completed,rejected,approved,in_progress))')
      }

      // Recurring pattern filter (only applies when showing recurring tasks)
      if (filters.taskType === 'recurring' && filters.recurringPattern !== 'all') {
        query = query.eq('recurring_pattern', filters.recurringPattern)
      }
    } else {
      // Default: don't show archived tasks
      query = query.neq('status', 'archived')
    }

    // For parents: Show ALL tasks (templates and instances) - no additional filtering

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    
    let tasksToReturn = data || []
    
    // FIXED: Eliminate "duplicate" appearance by hiding templates when instances exist
    // AND enrich instances with template enabled status for proper UI display
    if (tasksToReturn.length > 0) {
      const templates = tasksToReturn.filter(t => t.is_recurring && !t.parent_task_id)
      const instances = tasksToReturn.filter(t => t.parent_task_id)
      
      // Enrich instances with template enabled status
      const enrichedInstances = instances.map(instance => {
        const template = templates.find(t => t.id === instance.parent_task_id)
        if (template) {
          return {
            ...instance,
            // Pass template's enabled status to instance for UI display
            template_recurring_enabled: template.is_recurring_enabled
          }
        }
        return instance
      })
      
      // Get templates that have active instances
      const templatesWithActiveInstances = templates.filter(template => 
        instances.some(instance => 
          instance.parent_task_id === template.id && 
          ['pending', 'in_progress', 'completed', 'rejected', 'approved'].includes(instance.status)
        )
      )
      
      // FIXED: Templates must ALWAYS be hidden from parents
      // Only show: enriched instances + one-time tasks (never templates)
      const otherTasks = tasksToReturn.filter(t => !t.is_recurring && !t.parent_task_id)
      
      tasksToReturn = [...enrichedInstances, ...otherTasks]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    
    console.log('📤 TASKS SERVICE: getTasks returning', tasksToReturn?.length || 0, 'tasks for family (after duplicate filtering)')
    console.log('📝 TASKS SERVICE: Family task details:', tasksToReturn?.map(t => ({ 
      id: t.id, 
      title: t.title, 
      status: t.status,
      isRecurring: t.is_recurring,
      enabled: t.is_recurring_enabled,
      parentId: t.parent_task_id 
    })))
    
    return tasksToReturn
  },

  async getTasksForChild(childId: string, filters?: TaskFilters): Promise<Task[]> {
    console.log('🔍 TASKS SERVICE: getTasksForChild called for childId:', childId, 'with filters:', filters)
    
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url),
        task_completions(*)
      `)
      .eq('assigned_to', childId)

    // Apply filters (similar to above but no assignedTo filter)
    if (filters) {
      if (filters.status !== 'all') {
        if (filters.status === 'active') {
          query = query.in('status', ['pending', 'in_progress', 'completed'])
        } else {
          query = query.eq('status', filters.status)
        }
      }

      // Due date filter (same logic as above)
      if (filters.dueDate !== 'all') {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

        switch (filters.dueDate) {
          case 'overdue':
            query = query.lt('due_date', today.toISOString())
            break
          case 'today':
            query = query.gte('due_date', today.toISOString()).lt('due_date', tomorrow.toISOString())
            break
          case 'thisWeek':
            query = query.gte('due_date', today.toISOString()).lt('due_date', nextWeek.toISOString())
            break
          case 'noDueDate':
            query = query.is('due_date', null)
            break
        }
      }

      if (!filters.showArchived) {
        query = query.neq('status', 'archived')
      }

      // Task type filter (recurring vs one-time) - For children, only show instances
      if (filters.taskType !== 'all') {
        if (filters.taskType === 'recurring') {
          // Show only instances from recurring templates (children don't see templates)
          query = query.not('parent_task_id', 'is', null)
        } else if (filters.taskType === 'one-time') {
          // Show one-time tasks (not recurring and no parent)
          query = query.and('is_recurring.eq.false,parent_task_id.is.null')
        }
      }

      // Recurring pattern filter (only applies when showing recurring instances)
      if (filters.taskType === 'recurring' && filters.recurringPattern !== 'all') {
        query = query.eq('recurring_pattern', filters.recurringPattern)
      }
    } else {
      // Default: don't show archived tasks
      query = query.neq('status', 'archived')
    }

    // For children: Hide recurring templates, show only task instances
    // But only apply this if no specific taskType filter is set
    if (!filters || filters.taskType === 'all') {
      // Templates have: is_recurring=true AND parent_task_id IS NULL (hide these)
      // Instances have: is_recurring=false OR parent_task_id IS NOT NULL (show these)
      query = query.or('is_recurring.eq.false,parent_task_id.not.is.null')
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    
    console.log('📤 TASKS SERVICE: getTasksForChild returning', data?.length || 0, 'tasks for child')
    console.log('📝 TASKS SERVICE: Child task details:', data?.map(t => ({ 
      id: t.id, 
      title: t.title, 
      status: t.status,
      isRecurring: t.is_recurring,
      enabled: t.is_recurring_enabled,
      parentId: t.parent_task_id 
    })))
    
    return data || []
  },

  // ... existing methods ...

  // In the tasksService object, update these methods:

  async archiveTask(taskId: string): Promise<void> {
    console.log('Archiving task:', taskId) // Debug log
    
    const { error } = await supabase
      .from('tasks')
      .update({ 
        status: 'archived',
        archived_at: new Date().toISOString()
      })
      .eq('id', taskId)

    if (error) {
      console.error('Supabase archive error:', error)
      throw error
    }
    
    console.log('Task archived successfully') // Debug log
  },

  async archiveTasks(taskIds: string[]): Promise<void> {
    console.log('Archiving tasks:', taskIds) // Debug log
    
    const { error } = await supabase
      .from('tasks')
      .update({ 
        status: 'archived',
        archived_at: new Date().toISOString()
      })
      .in('id', taskIds)

    if (error) {
      console.error('Supabase bulk archive error:', error)
      throw error
    }
    
    console.log('Tasks archived successfully') // Debug log
  },

  async deleteTask(taskId: string): Promise<void> {
    // First check if task can be safely deleted
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('status')
      .eq('id', taskId)
      .single()

    if (taskError) throw taskError

    // Only allow deletion of pending and in_progress tasks
    if (task.status === 'completed' || task.status === 'approved' || task.status === 'rejected') {
      throw new Error('Cannot delete completed tasks. Use archive instead.')
    }

    // Delete task completions first
    const { error: completionsError } = await supabase
      .from('task_completions')
      .delete()
      .eq('task_id', taskId)

    if (completionsError) throw completionsError

    // Then delete the task
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) throw error
  },

  async deleteTasks(taskIds: string[]): Promise<void> {
    console.log('🗂️ Service: Attempting to delete tasks:', taskIds)
    
    // Check all tasks first
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, status, title')
      .in('id', taskIds)
  
    if (tasksError) {
      console.error('❌ Service: Error fetching tasks for deletion check:', tasksError)
      throw tasksError
    }
  
    console.log('📋 Service: Tasks found for deletion:', tasks)
  
    const completedTasks = tasks.filter(t => 
      t.status === 'completed' || t.status === 'approved' || t.status === 'rejected'
    )
  
    console.log('⚠️ Service: Completed tasks that cannot be deleted:', completedTasks)
  
    if (completedTasks.length > 0) {
      const completedTitles = completedTasks.map(t => t.title).join(', ')
      throw new Error(`Cannot delete completed tasks: "${completedTitles}". Use archive instead.`)
    }
  
    const deletableTasks = tasks.filter(t => 
      t.status === 'pending' || t.status === 'in_progress'
    )
  
    console.log('✅ Service: Deletable tasks:', deletableTasks)
  
    if (deletableTasks.length === 0) {
      console.warn('⚠️ Service: No deletable tasks found')
      return // Nothing to delete
    }
  
    const deletableTaskIds = deletableTasks.map(t => t.id)
  
    // Delete task completions first
    const { error: completionsError } = await supabase
      .from('task_completions')
      .delete()
      .in('task_id', deletableTaskIds)
  
    if (completionsError) {
      console.error('❌ Service: Error deleting task completions:', completionsError)
      throw completionsError
    }
  
    // Then delete the tasks
    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', deletableTaskIds)
  
    if (error) {
      console.error('❌ Service: Error deleting tasks:', error)
      throw error
    }
  
    console.log('✅ Service: Successfully deleted tasks:', deletableTaskIds)
  },

  async canDeleteTask(task: Task): Promise<boolean> {
    // Can only delete pending and in-progress tasks
    return task.status === 'pending'
  },

  async canArchiveTask(task: Task): Promise<boolean> {
    // Can archive completed, approved, or rejected tasks
    return task.status === 'approved'
  },

  // ... rest of existing methods stay the same ...

  async createTask(taskData: CreateTaskData, createdBy: string, familyId: string): Promise<Task> {
    let finalDueDate = taskData.due_date
    
    // Handle due date and time combination for one-time tasks
    if (taskData.due_date && !taskData.is_recurring) {
      const deadlineTime = taskData.deadline_time || '23:59'
      const [hours, minutes] = deadlineTime.split(':').map(Number)
      
      // Create date object with the specified date and time
      const dueDateTime = new Date(taskData.due_date)
      dueDateTime.setHours(hours, minutes, 0, 0)
      
      // Validate that the deadline is at least 30 minutes in the future
      const now = new Date()
      const minFutureTime = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes from now
      
      if (dueDateTime <= minFutureTime) {
        throw new Error('Task deadline must be at least 30 minutes in the future')
      }
      
      finalDueDate = dueDateTime.toISOString()
    }
    
    const insertData: any = {
      title: taskData.title,
      description: taskData.description || null,
      points: taskData.points,
      created_by: createdBy,
      family_id: familyId,
      status: 'pending',
      due_date: finalDueDate,
      // New fields
      task_type: taskData.task_type || 'non_negotiable',
      transferable: taskData.transferable ?? (taskData.task_type === 'negotiable'),
      penalty_points: taskData.penalty_points || 0,
      // Hanging task fields
      is_hanging: taskData.is_hanging || false,
      hanging_expires_at: taskData.hanging_expires_at || null,
      // Strict task field
      is_strict: taskData.is_strict || false
    }

    // Handle different assignment types
    if (taskData.is_hanging) {
      insertData.assigned_to = createdBy // Temporarily assign to creator
      insertData.is_available_for_pickup = true
      insertData.status = 'pending'
    } else {
      insertData.assigned_to = taskData.assigned_to
      insertData.is_available_for_pickup = false
    }

    // Handle recurring tasks
    if (taskData.is_recurring) {
      // Validate recurring task timing before creating
      const { recurringTasksService } = await import('@/services/recurringTasksService')
      const validation = recurringTasksService.validateRecurringTaskTiming({
        recurring_pattern: taskData.recurring_pattern as 'daily' | 'weekly' | 'monthly',
        recurring_time: taskData.recurring_time!,
        recurring_day_of_week: taskData.recurring_day_of_week,
        recurring_day_of_month: taskData.recurring_day_of_month
      })
      
      if (!validation.isValid) {
        throw new Error(validation.errorMessage)
      }
      
      insertData.is_recurring = true
      insertData.recurring_pattern = taskData.recurring_pattern
      insertData.recurring_time = taskData.recurring_time
      insertData.recurring_days = taskData.recurring_days
      insertData.recurring_day_of_week = taskData.recurring_day_of_week
      insertData.recurring_day_of_month = taskData.recurring_day_of_month
      // Only add is_recurring_enabled if it's provided (avoid database errors if column doesn't exist)
      if (taskData.is_recurring_enabled !== undefined) {
        insertData.is_recurring_enabled = taskData.is_recurring_enabled
      }
      insertData.parent_task_id = null // This is a template
      // Keep status as 'pending' - templates should be pending like regular tasks
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert(insertData)
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url)
      `)
      .single()

    if (error) throw error

    // Trigger notification for task creation (only for non-hanging tasks with assigned users)
    if (data.assigned_to && data.assigned_to !== createdBy && !taskData.is_hanging) {
      try {
        await notificationTriggers.triggerTaskCreated(
          data.id,
          data.title,
          data.assigned_to,
          createdBy
        )
      } catch (notificationError) {
        console.error('Failed to send task creation notification:', notificationError)
        // Don't throw error - task creation should succeed even if notification fails
      }
    }

    // If this is a recurring task, create the first instance immediately
    if (taskData.is_recurring) {
      await this.createFirstRecurringInstance(data)
    }

    return data
  },

  async updateTask(taskId: string, taskData: Partial<CreateTaskData>): Promise<Task> {
    const updateData: any = {}
    
    if (taskData.title !== undefined) updateData.title = taskData.title
    if (taskData.description !== undefined) updateData.description = taskData.description || null
    if (taskData.points !== undefined) updateData.points = taskData.points
    if (taskData.assigned_to !== undefined) updateData.assigned_to = taskData.assigned_to
    if (taskData.is_recurring_enabled !== undefined) updateData.is_recurring_enabled = taskData.is_recurring_enabled
    
    // Handle due date and deadline time updates
    if (taskData.due_date !== undefined || taskData.deadline_time !== undefined) {
      // Get current task to check if it's recurring
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('due_date, is_recurring')
        .eq('id', taskId)
        .single()
      
      if (currentTask && !currentTask.is_recurring) {
        // For one-time tasks, combine date and time
        const dueDate = taskData.due_date !== undefined ? taskData.due_date : (currentTask.due_date?.split('T')[0] || null)
        const deadlineTime = taskData.deadline_time !== undefined ? taskData.deadline_time : '23:59'
        
        if (dueDate && deadlineTime) {
          const [hours, minutes] = deadlineTime.split(':').map(Number)
          const dueDateTime = new Date(dueDate)
          dueDateTime.setHours(hours, minutes, 0, 0)
          
          // Validate that the deadline is at least 30 minutes in the future
          const now = new Date()
          const minFutureTime = new Date(now.getTime() + 30 * 60 * 1000)
          
          if (dueDateTime <= minFutureTime) {
            throw new Error('Task deadline must be at least 30 minutes in the future')
          }
          
          updateData.due_date = dueDateTime.toISOString()
        } else {
          updateData.due_date = null
        }
      } else {
        // For recurring tasks, just update the due_date directly
        if (taskData.due_date !== undefined) updateData.due_date = taskData.due_date || null
      }
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url),
        task_completions(*)
      `)
      .single()

    if (error) throw error
    return data
  },

  async updateTaskStatus(taskId: string, status: Task['status'], extraData?: any): Promise<void> {
    // First get the task details for notifications
    const { data: taskDetails, error: fetchError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        assigned_to,
        created_by,
        status
      `)
      .eq('id', taskId)
      .single()

    if (fetchError) throw fetchError

    const updateData: any = { status }
    
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    } else if (status === 'approved') {
      updateData.approved_at = new Date().toISOString()
    } else if (status === 'rejected' && extraData?.rejectionReason) {
      updateData.rejection_reason = extraData.rejectionReason
    } else if (status === 'in_progress') {
      updateData.rejection_reason = null
    } else if (status === 'archived') {
      updateData.archived_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)

    if (error) throw error

    // Trigger notifications for status changes
    if (taskDetails && extraData?.userId) {
      try {
        await notificationTriggers.triggerTaskStatusChange(
          taskDetails.id,
          taskDetails.title,
          status,
          extraData.userId, // Who made the change
          taskDetails.assigned_to
        )
      } catch (notificationError) {
        console.error('Failed to send task status change notification:', notificationError)
        // Don't throw error - status update should succeed even if notification fails
      }
    }

    // No longer generate recurring tasks on approval - now done when deadline passes
  },

  async completeTaskWithDetails(
    taskId: string, 
    userId: string, 
    completionData: TaskCompletionData
  ): Promise<void> {
    console.log('🎯 TASK COMPLETION: Starting completeTaskWithDetails for taskId:', taskId, 'userId:', userId)
    
    let photoUrl: string | null = null

    if (completionData.photo) {
      try {
        const fileExt = completionData.photo.name.split('.').pop()
        const fileName = `${userId}/${taskId}/${Date.now()}.${fileExt}`
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-photos')
          .upload(fileName, completionData.photo)

        if (uploadError) {
          console.error('Photo upload error:', uploadError)
          throw new Error('Failed to upload photo')
        }

        const { data: urlData } = supabase.storage
          .from('task-photos')
          .getPublicUrl(fileName)

        photoUrl = urlData.publicUrl
      } catch (error) {
        console.error('Error uploading photo:', error)
        throw error
      }
    }

    const { data: existingCompletion } = await supabase
      .from('task_completions')
      .select('id, photo_url')
      .eq('task_id', taskId)
      .single()

    if (existingCompletion) {
      if (existingCompletion.photo_url && photoUrl) {
        try {
          const oldFileName = existingCompletion.photo_url.split('/').pop()?.split('?')[0]
          if (oldFileName) {
            await supabase.storage
              .from('task-photos')
              .remove([`${userId}/${taskId}/${oldFileName}`])
          }
        } catch (error) {
          console.log('Could not delete old photo:', error)
        }
      }

      const { error: updateError } = await supabase
        .from('task_completions')
        .update({
          photo_url: photoUrl,
          completion_notes: completionData.notes || null,
          submitted_at: new Date().toISOString()
        })
        .eq('id', existingCompletion.id)

      if (updateError) throw updateError
    } else {
      const { error: completionError } = await supabase
        .from('task_completions')
        .insert({
          task_id: taskId,
          photo_url: photoUrl,
          completion_notes: completionData.notes || null,
          submitted_at: new Date().toISOString()
        })

      if (completionError) throw completionError
    }

    console.log('✅ TASK COMPLETION: Updating task status to completed for taskId:', taskId)
    
    const { error: taskError } = await supabase
      .from('tasks')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId)

    if (taskError) {
      console.error('❌ TASK COMPLETION: Error updating task status:', taskError)
      throw taskError
    }
    
    console.log('🎉 TASK COMPLETION: Task completion successful for taskId:', taskId)
  },

  async awardPoints(userId: string, points: number): Promise<void> {
    const { data: userData, error: getUserError } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single()

    if (getUserError) throw getUserError

    const { error } = await supabase
      .from('users')
      .update({ 
        points: (userData.points || 0) + points
      })
      .eq('id', userId)

    if (error) throw error
  },

  /**
   * Get all hanging tasks (unassigned tasks available for pickup)
   * Now filters by is_hanging and checks hanging_expires_at
   */
  async getHangingTasks(familyId: string): Promise<Task[]> {
    const now = new Date().toISOString()
    
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        created_by_user:users!tasks_created_by_fkey(name)
      `)
      .eq('family_id', familyId)
      .eq('is_hanging', true)
      .eq('is_available_for_pickup', true)
      .in('status', ['pending'])
      .or('is_recurring.eq.false,parent_task_id.not.is.null') // Not templates
      .or(`hanging_expires_at.is.null,hanging_expires_at.gt.${now}`) // Not expired
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Pick up a hanging task
   */
  async pickupHangingTask(taskId: string, childId: string): Promise<Task> {
    // First verify the task is available for pickup
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('is_hanging, is_available_for_pickup, status, assigned_to, hanging_expires_at')
      .eq('id', taskId)
      .single()

    if (fetchError) throw fetchError
    
    if (!task || !task.is_hanging || !task.is_available_for_pickup) {
      throw new Error('Task is not available for pickup')
    }

    if (task.status !== 'pending') {
      throw new Error('Task is no longer available')
    }

    // Check if task has expired
    if (task.hanging_expires_at) {
      const now = new Date()
      const expiresAt = new Date(task.hanging_expires_at)
      if (now >= expiresAt) {
        throw new Error('This hanging task has expired')
      }
    }

    // Assign the task to the child
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        assigned_to: childId,
        is_available_for_pickup: false,
        is_hanging: false, // No longer hanging once picked up
        hanging_expires_at: null, // Clear expiration
        status: 'in_progress'
      })
      .eq('id', taskId)
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url)
      `)
      .single()

    if (updateError) throw updateError
    return updatedTask
  },

  /**
   * Get expired hanging tasks for parent management
   */
  async getExpiredHangingTasks(familyId: string): Promise<Task[]> {
    const now = new Date().toISOString()
    
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        created_by_user:users!tasks_created_by_fkey(name)
      `)
      .eq('family_id', familyId)
      .eq('is_hanging', true)
      .eq('is_available_for_pickup', true)
      .in('status', ['pending'])
      .not('hanging_expires_at', 'is', null)
      .lt('hanging_expires_at', now)
      .order('hanging_expires_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  /**
   * Extend hanging task expiration
   */
  async extendHangingTask(taskId: string, newExpiresAt: string): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ hanging_expires_at: newExpiresAt })
      .eq('id', taskId)
      .eq('is_hanging', true)
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url)
      `)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Convert hanging task to assigned task
   */
  async assignHangingTask(taskId: string, childId: string): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        assigned_to: childId,
        is_hanging: false,
        is_available_for_pickup: false,
        hanging_expires_at: null,
        status: 'pending'
      })
      .eq('id', taskId)
      .eq('is_hanging', true)
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url)
      `)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Check if a task can be negotiated
   */
  async canNegotiateTask(task: Task): Promise<boolean> {
    return task.task_type === 'negotiable' && task.transferable === true && task.status === 'pending'
  },

  /**
   * Check if a task can be transferred
   */
  async canTransferTask(task: Task): Promise<boolean> {
    return task.transferable === true && ['pending', 'in_progress'].includes(task.status)
  },

  /**
   * Get recurring task templates for management (parents only)
   */
  async getRecurringTemplates(familyId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url)
      `)
      .eq('family_id', familyId)
      .eq('is_recurring', true)
      .is('parent_task_id', null) // Only templates, not instances
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Create the first recurring instance immediately when template is created
   */
  async createFirstRecurringInstance(template: Task): Promise<void> {
    const now = new Date()
    const timeString = template.recurring_time || '23:59'
    const [hours, minutes] = timeString.split(':').map(Number)
    
    // Calculate due date based on recurring pattern
    let dueDate: Date
    
    switch (template.recurring_pattern) {
      case 'daily':
        // Always find the next available daily slot
        const targetTimeToday = new Date()
        targetTimeToday.setHours(hours, minutes, 0, 0)
        
        // Add 30-minute buffer to avoid creating tasks too soon
        const minFutureTime = new Date(now.getTime() + 30 * 60 * 1000)
        
        if (targetTimeToday <= minFutureTime) {
          // Time has passed today or is too soon, schedule for tomorrow
          dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + 1)
          dueDate.setHours(hours, minutes, 0, 0)
        } else {
          // Time hasn't passed yet and is far enough, schedule for today
          dueDate = targetTimeToday
        }
        break
        
      case 'weekly':
        if (template.recurring_day_of_week !== null && template.recurring_day_of_week !== undefined) {
          const currentDay = now.getDay() // 0 = Sunday, 1 = Monday, etc.
          const targetDay = template.recurring_day_of_week
          let daysUntilTarget = (targetDay - currentDay + 7) % 7
          
          // Create target date for this week
          dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + daysUntilTarget)
          dueDate.setHours(hours, minutes, 0, 0)
          
          // Add 30-minute buffer to avoid creating tasks too soon
          const minFutureTime = new Date(now.getTime() + 30 * 60 * 1000)
          
          // If target is today but time has passed or is too soon, move to next week
          if (dueDate <= minFutureTime) {
            dueDate.setDate(dueDate.getDate() + 7) // Next week
          }
        } else {
          // Fallback: next week same day if no day specified
          dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + 7)
          dueDate.setHours(hours, minutes, 0, 0)
        }
        break
        
      case 'monthly':
        if (template.recurring_day_of_month !== null && template.recurring_day_of_month !== undefined) {
          const currentMonth = now.getMonth()
          const currentYear = now.getFullYear()
          const targetDay = template.recurring_day_of_month
          
          // Try target day this month
          const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
          const actualTargetDay = Math.min(targetDay, lastDayOfMonth)
          
          dueDate = new Date(currentYear, currentMonth, actualTargetDay)
          dueDate.setHours(hours, minutes, 0, 0)
          
          // Add 30-minute buffer to avoid creating tasks too soon
          const minFutureTime = new Date(now.getTime() + 30 * 60 * 1000)
          
          // If target date has passed this month or is too soon, move to next month
          if (dueDate <= minFutureTime) {
            const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
            const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
            
            const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate()
            const nextActualTargetDay = Math.min(targetDay, lastDayOfNextMonth)
            
            dueDate = new Date(nextYear, nextMonth, nextActualTargetDay)
            dueDate.setHours(hours, minutes, 0, 0)
          }
        } else {
          // Fallback: next month same day if no day specified
          dueDate = new Date()
          dueDate.setMonth(dueDate.getMonth() + 1)
          dueDate.setHours(hours, minutes, 0, 0)
        }
        break
        
      default:
        // Fallback: tomorrow
        dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 1)
        dueDate.setHours(hours, minutes, 0, 0)
    }
    
    // Use the properly constructed dueDate directly
    const dueDateTime = dueDate.toISOString()

    // Create the first instance
    const { error } = await supabase
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
        is_recurring: false, // Instance is not recurring
        status: 'pending', // Start as pending
        is_strict: template.is_strict || false, // Inherit strict setting
        sequence_number: 1 // First instance gets sequence number 1
      })

    if (error) {
      console.error('Error creating first recurring instance:', error)
      throw error
    }

    console.log(`✅ Created first ${template.recurring_pattern} instance for: ${template.title}`)
  },

  /**
   * Update recurring task template and optionally all future instances
   */
  async updateRecurringTask(
    taskId: string, 
    taskData: Partial<CreateTaskData>, 
    updateAllUpcoming: boolean = false
  ): Promise<void> {
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('is_recurring, parent_task_id')
      .eq('id', taskId)
      .single()

    if (fetchError) throw fetchError

    const isTemplate = task.is_recurring && !task.parent_task_id
    const isInstance = !task.is_recurring && task.parent_task_id

    if (updateAllUpcoming) {
      if (isTemplate) {
        // Update template AND all future instances
        await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', taskId) // Update template

        // Update all pending/in-progress instances
        const { error: instancesError } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('parent_task_id', taskId)
          .in('status', ['pending', 'in_progress'])

        if (instancesError) throw instancesError
      } else if (isInstance) {
        // Update the template first (so future tasks use the new data)
        const { error: templateError } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', task.parent_task_id) // Update the template

        if (templateError) throw templateError

        // Then update all future instances from the same template
        const { error: instancesError } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('parent_task_id', task.parent_task_id)
          .in('status', ['pending', 'in_progress'])

        if (instancesError) throw instancesError
      }
    } else {
      // Update only this specific task
      const { error: updateError } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskId)

      if (updateError) throw updateError
    }
  },

  /**
   * Delete recurring task template and optionally all future instances
   */
  async deleteRecurringTask(taskId: string, deleteAllUpcoming: boolean = false): Promise<void> {
    console.log('🔄 Service: deleteRecurringTask called with:', { taskId, deleteAllUpcoming })
    
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('is_recurring, parent_task_id, title')
      .eq('id', taskId)
      .single()

    if (fetchError) {
      console.error('❌ Service: Error fetching task:', fetchError)
      throw fetchError
    }

    console.log('📋 Service: Task details:', task)
    
    const isTemplate = task.is_recurring && !task.parent_task_id
    const isInstance = !task.is_recurring && task.parent_task_id
    
    console.log('🔍 Service: Task classification:', { isTemplate, isInstance })

    if (deleteAllUpcoming) {
      if (isTemplate) {
        // TEMPLATE DELETION: This should rarely happen since we pause instances, not templates
        // But if it does, disable template and delete any pending instances
        console.log('🗑️ Service: Disabling template to stop future generation...')
        
        const { error: disableError } = await supabase
          .from('tasks')
          .update({ 
            is_recurring_enabled: false,
            status: 'archived'
          })
          .eq('id', taskId)

        if (disableError) {
          console.error('❌ Service: Error disabling template:', disableError)
          throw disableError
        }
        
        // Also delete any future pending instances
        const { error: instancesError } = await supabase
          .from('tasks')
          .delete()
          .eq('parent_task_id', taskId)
          .in('status', ['pending']) // Only delete future pending tasks
          
        if (instancesError) {
          console.error('❌ Service: Error deleting future instances:', instancesError)
          throw instancesError
        }
        
        console.log('✅ Service: Template disabled and future tasks deleted')
        
      } else if (isInstance) {
        // INSTANCE DELETION (Your scenario: Delete Month 5 and stop future generation)
        console.log('🗑️ Service: Deleting current instance and stopping future generation...')
        
        // Step 1: Delete this current instance
        const { error: deleteCurrentError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          
        if (deleteCurrentError) {
          console.error('❌ Service: Error deleting current instance:', deleteCurrentError)
          throw deleteCurrentError
        }
        
        console.log('✅ Service: Current instance deleted')
        
        // Step 2: Disable the template to stop future generation
        const { error: disableTemplateError } = await supabase
          .from('tasks')
          .update({ 
            is_recurring_enabled: false
          })
          .eq('id', task.parent_task_id)
          
        if (disableTemplateError) {
          console.error('❌ Service: Error disabling template:', disableTemplateError)
          throw disableTemplateError
        }
        
        console.log('✅ Service: Template disabled, no more tasks will be generated')
      }
    } else {
      // Delete only this specific task (regular single deletion)
      console.log('🗑️ Service: Deleting single task...')
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (deleteError) {
        console.error('❌ Service: Error deleting single task:', deleteError)
        throw deleteError
      }
      
      console.log('✅ Service: Single task deleted')
    }
  },

  /**
   * Check if a task is part of a recurring series
   */
  async isRecurringTask(taskId: string): Promise<boolean> {
    const { data: task, error } = await supabase
      .from('tasks')
      .select('is_recurring, parent_task_id')
      .eq('id', taskId)
      .single()

    if (error) throw error
    
    // It's recurring if it's a template OR an instance from a recurring template
    return (task.is_recurring && !task.parent_task_id) || (!task.is_recurring && !!task.parent_task_id)
  }
}
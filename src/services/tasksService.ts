import { supabase } from '@/lib/supabase'
import { Task, CreateTaskData, TaskCompletionData, TaskFilters } from '@/types'

export const tasksService = {
  async getTasks(familyId: string, filters?: TaskFilters): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name),
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
    } else {
      // Default: don't show archived tasks
      query = query.neq('status', 'archived')
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getTasksForChild(childId: string, filters?: TaskFilters): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select(`
        *,
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
    } else {
      // Default: don't show archived tasks
      query = query.neq('status', 'archived')
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
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
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: taskData.title,
        description: taskData.description || null,
        points: taskData.points,
        assigned_to: taskData.assigned_to,
        created_by: createdBy,
        family_id: familyId,
        status: 'pending',
        due_date: taskData.due_date || null
      })
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name)
      `)
      .single()

    if (error) throw error
    return data
  },

  async updateTask(taskId: string, taskData: Partial<CreateTaskData>): Promise<Task> {
    const updateData: any = {}
    
    if (taskData.title !== undefined) updateData.title = taskData.title
    if (taskData.description !== undefined) updateData.description = taskData.description || null
    if (taskData.points !== undefined) updateData.points = taskData.points
    if (taskData.assigned_to !== undefined) updateData.assigned_to = taskData.assigned_to
    if (taskData.due_date !== undefined) updateData.due_date = taskData.due_date || null

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name),
        task_completions(*)
      `)
      .single()

    if (error) throw error
    return data
  },

  async updateTaskStatus(taskId: string, status: Task['status'], extraData?: any): Promise<void> {
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
  },

  async completeTaskWithDetails(
    taskId: string, 
    userId: string, 
    completionData: TaskCompletionData
  ): Promise<void> {
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

    const { error: taskError } = await supabase
      .from('tasks')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId)

    if (taskError) throw taskError
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
  }
}
import { useState, useEffect } from 'react'
import { tasksService } from '@/services/tasksService'
import { Task, CreateTaskData, TaskCompletionData, TaskFilters } from '@/types'
import toast from 'react-hot-toast'

export const useTasks = (familyId?: string, childId?: string) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([]) // Keep unfiltered tasks for stats
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all', // CHANGE FROM 'active' TO 'all'
    dueDate: 'all',
    assignedTo: 'all',
    showArchived: false,
    taskType: 'all',
    recurringPattern: 'all'
  })

  useEffect(() => {
    if (familyId || childId) {
      loadTasks()
    }
  }, [familyId, childId, filters])

  // Also load all tasks for accurate stats
  useEffect(() => {
    if (familyId || childId) {
      loadAllTasksForStats()
    }
  }, [familyId, childId])

  const loadTasks = async () => {
    try {
      console.log('📥 LOAD TASKS: Starting loadTasks for', { familyId, childId, filters })
      setLoading(true)
      let tasksData: Task[]

      if (childId) {
        console.log('👶 LOAD TASKS: Loading tasks for child:', childId)
        tasksData = await tasksService.getTasksForChild(childId, filters)
        
        // Check for overdue tasks and apply penalties immediately (client-side)
        const { overdueTasksService } = await import('@/services/overdueTasksService')
        const { processedTasks, penaltiesApplied } = await overdueTasksService.checkAndProcessOverdueTasks(tasksData)
        
        if (penaltiesApplied > 0) {
          toast.error(`⚡ ${penaltiesApplied} task${penaltiesApplied > 1 ? 's' : ''} overdue - penalty points applied`)
        }
        
        tasksData = processedTasks
      } else if (familyId) {
        console.log('👨‍👩‍👧‍👦 LOAD TASKS: Loading tasks for family:', familyId)
        tasksData = await tasksService.getTasks(familyId, filters)
      } else {
        console.log('❓ LOAD TASKS: No familyId or childId provided')
        tasksData = []
      }

      console.log('📊 LOAD TASKS: Retrieved', tasksData.length, 'tasks')
      console.log('📋 LOAD TASKS: Task summary:', tasksData.map(t => ({ 
        id: t.id, 
        title: t.title, 
        status: t.status,
        isRecurring: !!t.recurring_pattern,
        enabled: t.is_recurring_enabled 
      })))
      
      setTasks(tasksData)
    } catch (error) {
      console.error('Error loading tasks:', error)
      toast.error('Error loading tasks')
    } finally {
      setLoading(false)
    }
  }

  const loadAllTasksForStats = async () => {
    try {
      console.log('📈 LOAD ALL STATS: Starting loadAllTasksForStats for', { familyId, childId })
      let allTasksData: Task[]

      // Load ALL tasks without filters for accurate stats
      const allFilters: TaskFilters = {
        status: 'all',
        dueDate: 'all',
        assignedTo: 'all',
        showArchived: true, // Include archived for complete stats
        taskType: 'all',
        recurringPattern: 'all'
      }

      if (childId) {
        allTasksData = await tasksService.getTasksForChild(childId, allFilters)
      } else if (familyId) {
        allTasksData = await tasksService.getTasks(familyId, allFilters)
      } else {
        allTasksData = []
      }

      console.log('📊 LOAD ALL STATS: Retrieved', allTasksData.length, 'tasks for stats')
      setAllTasks(allTasksData)
    } catch (error) {
      console.error('Error loading all tasks for stats:', error)
    }
  }

  const updateFilters = (newFilters: Partial<TaskFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const clearFilters = () => {
    setFilters({
      status: 'all', // CHANGE FROM 'active' TO 'all'
      dueDate: 'all',
      assignedTo: 'all',
      showArchived: false,
      taskType: 'all',
      recurringPattern: 'all'
    })
  }

  const createTask = async (taskData: CreateTaskData, createdBy: string, familyId: string) => {
    try {
      const newTask = await tasksService.createTask(taskData, createdBy, familyId)
      setTasks(prev => [newTask, ...prev])
      setAllTasks(prev => [newTask, ...prev]) // Also update all tasks
      toast.success('Task created successfully! 🎉')
      return newTask
    } catch (error: any) {
      console.error('Error creating task:', error)
      console.error('Error message:', error?.message)
      console.error('Error details:', error?.details || error?.hint || error?.code)
      toast.error(error?.message || 'Error creating task')
      throw error
    }
  }

  const updateTask = async (taskId: string, taskData: Partial<CreateTaskData>, updateAllUpcoming?: boolean) => {
    try {
      if (updateAllUpcoming !== undefined) {
        // Use recurring task update method
        await tasksService.updateRecurringTask(taskId, taskData, updateAllUpcoming)
        if (updateAllUpcoming) {
          // If updating all upcoming, refresh the entire task list
          await loadTasks()
          toast.success('Recurring task series updated successfully! ✏️')
        } else {
          // If updating only one, use regular update logic
          const updatedTask = await tasksService.updateTask(taskId, taskData)
          setTasks(prev => prev.map(task => 
            task.id === taskId ? updatedTask : task
          ))
          setAllTasks(prev => prev.map(task => 
            task.id === taskId ? updatedTask : task
          ))
          toast.success('Task updated successfully! ✏️')
          return updatedTask
        }
      } else {
        // Regular task update
        const updatedTask = await tasksService.updateTask(taskId, taskData)
        setTasks(prev => prev.map(task => 
          task.id === taskId ? updatedTask : task
        ))
        setAllTasks(prev => prev.map(task => 
          task.id === taskId ? updatedTask : task
        ))
        toast.success('Task updated successfully! ✏️')
        return updatedTask
      }
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Error updating task')
      throw error
    }
  }

  const deleteTask = async (taskId: string, deleteAllUpcoming?: boolean) => {
    try {
      if (deleteAllUpcoming !== undefined) {
        // Use recurring task delete method
        await tasksService.deleteRecurringTask(taskId, deleteAllUpcoming)
        if (deleteAllUpcoming) {
          // If deleting all upcoming, refresh the entire task list
          await loadTasks()
          toast.success('Recurring task series deleted successfully')
        } else {
          // If deleting only one, just remove from local state
          setTasks(prev => prev.filter(task => task.id !== taskId))
          setAllTasks(prev => prev.filter(task => task.id !== taskId))
          toast.success('Task deleted successfully')
        }
      } else {
        // Regular task delete
        await tasksService.deleteTask(taskId)
        setTasks(prev => prev.filter(task => task.id !== taskId))
        setAllTasks(prev => prev.filter(task => task.id !== taskId))
        toast.success('Task deleted successfully')
      }
    } catch (error: any) {
      console.error('Error deleting task:', error)
      if (error.message?.includes('Cannot delete completed tasks')) {
        toast.error('Cannot delete completed tasks. Use archive instead.')
      } else {
        toast.error('Error deleting task')
      }
      throw error
    }
  }

  const deleteTasks = async (taskIds: string[]) => {
    try {
      await tasksService.deleteTasks(taskIds)
      setTasks(prev => prev.filter(task => !taskIds.includes(task.id)))
      setAllTasks(prev => prev.filter(task => !taskIds.includes(task.id)))
      toast.success(`${taskIds.length} tasks deleted successfully`)
    } catch (error: any) {
      console.error('Error deleting tasks:', error)
      if (error.message?.includes('Cannot delete completed tasks')) {
        toast.error('Cannot delete completed tasks. Use archive instead.')
      } else {
        toast.error('Error deleting tasks')
      }
      throw error
    }
  }

  const archiveTask = async (taskId: string) => {
    try {
      await tasksService.archiveTask(taskId)
      
      // Update both task lists
      const updateTaskStatus = (task: Task) => 
        task.id === taskId 
          ? { ...task, status: 'archived' as const, archived_at: new Date().toISOString() }
          : task

      setTasks(prev => prev.map(updateTaskStatus))
      setAllTasks(prev => prev.map(updateTaskStatus))
      
      toast.success('Task archived successfully')
    } catch (error) {
      console.error('Error archiving task:', error)
      toast.error('Error archiving task')
      throw error
    }
  }

  const archiveTasks = async (taskIds: string[]) => {
    try {
      await tasksService.archiveTasks(taskIds)
      
      // Update both task lists
      const updateTasksStatus = (task: Task) => 
        taskIds.includes(task.id)
          ? { ...task, status: 'archived' as const, archived_at: new Date().toISOString() }
          : task

      setTasks(prev => prev.map(updateTasksStatus))
      setAllTasks(prev => prev.map(updateTasksStatus))
      
      toast.success(`${taskIds.length} tasks archived successfully`)
    } catch (error) {
      console.error('Error archiving tasks:', error)
      toast.error('Error archiving tasks')
      throw error
    }
  }

  const canEditTask = (task: Task): boolean => {
    return task.status === 'pending' || task.status === 'in_progress'
  }

  const canDeleteTask = (task: Task): boolean => {
    return task.status === 'pending'
  }

  const canArchiveTask = (task: Task): boolean => {
    return task.status === 'approved'
  }

  const updateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      await tasksService.updateTaskStatus(taskId, status)
      
      const updateTaskInList = (task: Task) => 
        task.id === taskId 
          ? { ...task, status, ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}) }
          : task

      setTasks(prev => prev.map(updateTaskInList))
      setAllTasks(prev => prev.map(updateTaskInList))

      if (status === 'in_progress') {
        toast.success('Task started! 🚀')
      }
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Error updating task')
    }
  }

  const completeTaskWithDetails = async (
    taskId: string, 
    userId: string, 
    completionData: TaskCompletionData
  ) => {
    try {
      console.log('🔄 COMPLETE TASK: Starting completion for taskId:', taskId)
      console.log('🔄 COMPLETE TASK: Task details:', { taskId, userId, completionData })
      
      await tasksService.completeTaskWithDetails(taskId, userId, completionData)
      
      console.log('✅ COMPLETE TASK: Service call completed successfully')
      
      const updateTaskInList = (task: Task) => 
        task.id === taskId 
          ? { ...task, status: 'completed' as const, completed_at: new Date().toISOString() }
          : task

      setTasks(prev => prev.map(updateTaskInList))
      setAllTasks(prev => prev.map(updateTaskInList))

      console.log('✅ COMPLETE TASK: UI state updated')
      toast.success('Task completed! Waiting for parent approval... ⭐')
    } catch (error) {
      console.error('❌ COMPLETE TASK: Error completing task:', error)
      toast.error('Error completing task')
      throw error
    }
  }

  const approveTask = async (taskId: string, assignedUserId: string, points: number) => {
    try {
      await tasksService.updateTaskStatus(taskId, 'approved')
      
      // Check if task has point split from negotiation
      const task = allTasks.find(t => t.id === taskId)
      if (task && task.point_split) {
        // Distribute points according to negotiated split
        const pointSplit = task.point_split as any
        
        // Award points to final assignee (current assigned user)
        if (pointSplit.final_assignee && pointSplit.final_assignee > 0) {
          await tasksService.awardPoints(assignedUserId, pointSplit.final_assignee)
        }
        
        // Award points to original assignee if they get any
        if (pointSplit.original_assignee && pointSplit.original_assignee > 0) {
          // Find the original assignee from task history or negotiation
          const originalAssigneeId = task.original_assignee || task.created_by
          if (originalAssigneeId && originalAssigneeId !== assignedUserId) {
            await tasksService.awardPoints(originalAssigneeId, pointSplit.original_assignee)
          }
        }
        
        toast.success(`Task approved! Points distributed: ${pointSplit.final_assignee} to final assignee, ${pointSplit.original_assignee} to original assignee! ⭐`)
      } else {
        // Regular task - award all points to assigned user
        await tasksService.awardPoints(assignedUserId, points)
        toast.success(`Task approved! ${points} points awarded! ⭐`)
      }
      
      const updateTaskInList = (task: Task) => 
        task.id === taskId 
          ? { ...task, status: 'approved' as const, approved_at: new Date().toISOString() }
          : task

      setTasks(prev => prev.map(updateTaskInList))
      setAllTasks(prev => prev.map(updateTaskInList))

    } catch (error) {
      console.error('Error approving task:', error)
      toast.error('Error approving task')
    }
  }

  const rejectTask = async (taskId: string, rejectionReason?: string) => {
    try {
      await tasksService.updateTaskStatus(taskId, 'rejected', { rejectionReason })
      
      const updateTaskInList = (task: Task) => 
        task.id === taskId 
          ? { ...task, status: 'rejected' as const, rejection_reason: rejectionReason || null }
          : task

      setTasks(prev => prev.map(updateTaskInList))
      setAllTasks(prev => prev.map(updateTaskInList))

      toast.success('Task rejected')
    } catch (error) {
      console.error('Error rejecting task:', error)
      toast.error('Error rejecting task')
    }
  }

  // Get filter stats from ALL tasks, not just filtered ones
  const getFilterStats = () => {
    return {
      active: allTasks.filter(t => ['pending', 'in_progress', 'completed'].includes(t.status)).length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      inProgress: allTasks.filter(t => t.status === 'in_progress').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      approved: allTasks.filter(t => t.status === 'approved').length,
      rejected: allTasks.filter(t => t.status === 'rejected').length,
      archived: allTasks.filter(t => t.status === 'archived').length,
      overdue: allTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && !['approved', 'archived'].includes(t.status)).length
    }
  }

  const updateRecurringTask = async (taskId: string, taskData: Partial<CreateTaskData>, updateAllUpcoming: boolean = false) => {
    try {
      await tasksService.updateRecurringTask(taskId, taskData, updateAllUpcoming)
      await loadTasks() // Reload to show changes
      await loadAllTasksForStats()
      
      const message = updateAllUpcoming ? 
        'Recurring task updated for all upcoming instances! 🔄' : 
        'Task updated! 📝'
      toast.success(message)
    } catch (error) {
      console.error('Error updating recurring task:', error)
      toast.error('Error updating task')
      throw error
    }
  }

  const deleteRecurringTask = async (taskId: string, deleteAllUpcoming: boolean = false) => {
    try {
      await tasksService.deleteRecurringTask(taskId, deleteAllUpcoming)
      await loadTasks() // Reload to show changes
      await loadAllTasksForStats()
      
      const message = deleteAllUpcoming ? 
        'Recurring task and all upcoming instances deleted! 🗑️' : 
        'Task deleted! 🗑️'
      toast.success(message)
    } catch (error) {
      console.error('Error deleting recurring task:', error)
      toast.error('Error deleting task')
      throw error
    }
  }

  const isRecurringTask = async (taskId: string): Promise<boolean> => {
    try {
      return await tasksService.isRecurringTask(taskId)
    } catch (error) {
      console.error('Error checking if task is recurring:', error)
      return false
    }
  }

  return {
    tasks,
    loading,
    filters,
    updateFilters,
    clearFilters,
    createTask,
    updateTask,
    deleteTask,
    deleteTasks,
    archiveTask,
    archiveTasks,
    canEditTask,
    canDeleteTask,
    canArchiveTask,
    updateTaskStatus,
    completeTaskWithDetails,
    approveTask,
    rejectTask,
    getFilterStats,
    refetchTasks: loadTasks,
    // New recurring task methods
    updateRecurringTask,
    deleteRecurringTask,
    isRecurringTask
  }
}
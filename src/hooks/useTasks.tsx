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
    showArchived: false
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
      setLoading(true)
      let tasksData: Task[]

      if (childId) {
        tasksData = await tasksService.getTasksForChild(childId, filters)
      } else if (familyId) {
        tasksData = await tasksService.getTasks(familyId, filters)
      } else {
        tasksData = []
      }

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
      let allTasksData: Task[]

      // Load ALL tasks without filters for accurate stats
      const allFilters: TaskFilters = {
        status: 'all',
        dueDate: 'all',
        assignedTo: 'all',
        showArchived: true // Include archived for complete stats
      }

      if (childId) {
        allTasksData = await tasksService.getTasksForChild(childId, allFilters)
      } else if (familyId) {
        allTasksData = await tasksService.getTasks(familyId, allFilters)
      } else {
        allTasksData = []
      }

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
      showArchived: false
    })
  }

  const createTask = async (taskData: CreateTaskData, createdBy: string, familyId: string) => {
    try {
      const newTask = await tasksService.createTask(taskData, createdBy, familyId)
      setTasks(prev => [newTask, ...prev])
      setAllTasks(prev => [newTask, ...prev]) // Also update all tasks
      toast.success('Task created successfully! 🎉')
      return newTask
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Error creating task')
      throw error
    }
  }

  const updateTask = async (taskId: string, taskData: Partial<CreateTaskData>) => {
    try {
      const updatedTask = await tasksService.updateTask(taskId, taskData)
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ))
      setAllTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ))
      toast.success('Task updated successfully! ✏️')
      return updatedTask
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Error updating task')
      throw error
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      await tasksService.deleteTask(taskId)
      setTasks(prev => prev.filter(task => task.id !== taskId))
      setAllTasks(prev => prev.filter(task => task.id !== taskId))
      toast.success('Task deleted successfully')
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
      await tasksService.completeTaskWithDetails(taskId, userId, completionData)
      
      const updateTaskInList = (task: Task) => 
        task.id === taskId 
          ? { ...task, status: 'completed' as const, completed_at: new Date().toISOString() }
          : task

      setTasks(prev => prev.map(updateTaskInList))
      setAllTasks(prev => prev.map(updateTaskInList))

      toast.success('Task completed! Waiting for parent approval... ⭐')
    } catch (error) {
      console.error('Error completing task:', error)
      toast.error('Error completing task')
      throw error
    }
  }

  const approveTask = async (taskId: string, assignedUserId: string, points: number) => {
    try {
      await tasksService.updateTaskStatus(taskId, 'approved')
      await tasksService.awardPoints(assignedUserId, points)
      
      const updateTaskInList = (task: Task) => 
        task.id === taskId 
          ? { ...task, status: 'approved' as const, approved_at: new Date().toISOString() }
          : task

      setTasks(prev => prev.map(updateTaskInList))
      setAllTasks(prev => prev.map(updateTaskInList))

      toast.success(`Task approved! ${points} points awarded! ⭐`)
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
    refetchTasks: loadTasks
  }
}
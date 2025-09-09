'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useTasks } from '@/hooks/useTasks'
import { useFamilyMembers } from '@/hooks/useFamilyMembers'
import { CreateTaskData, Task } from '@/types'
import TaskReviewModal from '@/components/tasks/TaskReviewModal'
import StrictTaskReviewModal from '@/components/tasks/StrictTaskReviewModal'
import TaskEditModal from '@/components/tasks/TaskEditModal'
import TaskDeleteModal from '@/components/tasks/TaskDeleteModal'
import TaskFilters from '@/components/tasks/TaskFilters'
import RecurringTaskModal from '@/components/tasks/RecurringTaskModal'
import RecurringTaskActionModal from '@/components/tasks/RecurringTaskActionModal'
import { Edit3, Trash2, Archive } from 'lucide-react'
import Link from 'next/link'
import TaskCard from '@/components/tasks/TaskCard'
import ExpiredHangingTasksCard from '@/components/tasks/ExpiredHangingTasksCard'
import { useRecurringTaskCheck } from '@/hooks/useRecurringTaskCheck'
import { tasksService } from '@/services/tasksService'
import { shouldShowStrictTaskReviewModal } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function TasksPage() {
  const { user, requireAuth } = useAuth()
  const { familyMembers: children } = useFamilyMembers(user?.family_id)
  const { 
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
    approveTask, 
    rejectTask,
    getFilterStats,
    refetchTasks
  } = useTasks(user?.family_id)
  
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showStrictReviewModal, setShowStrictReviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRecurringActionModal, setShowRecurringActionModal] = useState(false)
  const [recurringActionType, setRecurringActionType] = useState<'edit' | 'delete'>('edit')
  const [editAllUpcoming, setEditAllUpcoming] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [intendedAction, setIntendedAction] = useState<'delete' | 'archive' | null>(null)

  
  const [formData, setFormData] = useState<CreateTaskData & { 
    dueDate: string
    deadlineTime: string
    taskType: 'negotiable' | 'non_negotiable'
    hangingExpiresDate: string
    hangingExpiresTime: string
  }>({
    title: '',
    description: '',
    points: 5,
    assigned_to: '',
    dueDate: '',
    deadlineTime: '23:59',
    penalty_points: 0,
    task_type: 'non_negotiable',
    transferable: false,
    taskType: 'non_negotiable',
    hangingExpiresDate: '',
    hangingExpiresTime: '10:00',
    is_strict: false
  })

  useEffect(() => {
    requireAuth('parent')
  }, [])

  // Check for overdue recurring tasks - ONLY on parent side
  useRecurringTaskCheck({
    enabled: !!user,
    refetchTasks,
    onTasksGenerated: (count) => {
      if (count > 0) {
        toast.success(`${count} new recurring task${count > 1 ? 's' : ''} created!`)
      }
    }
  })

  const childrenList = children.filter(member => member.role === 'child')
  const stats = getFilterStats()

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || (!formData.assigned_to && formData.assigned_to !== 'hanging')) return

    // Client-side validation for deadline time
    if (formData.dueDate && formData.deadlineTime) {
      const [hours, minutes] = formData.deadlineTime.split(':').map(Number)
      const dueDateTime = new Date(formData.dueDate)
      dueDateTime.setHours(hours, minutes, 0, 0)
      
      const now = new Date()
      const minFutureTime = new Date(now.getTime() + 30 * 60 * 1000)
      
      if (dueDateTime <= minFutureTime) {
        toast.error('Task deadline must be at least 30 minutes in the future')
        return
      }
    }

    // Calculate hanging expires at if hanging task
    let hangingExpiresAt: string | null = null
    if (formData.assigned_to === 'hanging') {
      if (!formData.hangingExpiresDate || !formData.hangingExpiresTime) {
        toast.error('Please set valid until date and time for hanging task')
        return
      }
      const [hours, minutes] = formData.hangingExpiresTime.split(':').map(Number)
      const expiresDateTime = new Date(formData.hangingExpiresDate)
      expiresDateTime.setHours(hours, minutes, 0, 0)
      hangingExpiresAt = expiresDateTime.toISOString()
    }

    setCreating(true)
    try {
      await createTask({
        title: formData.title,
        description: formData.description,
        points: formData.points,
        assigned_to: formData.assigned_to === 'hanging' ? user.id : formData.assigned_to,
        due_date: formData.dueDate || null,
        deadline_time: formData.dueDate ? formData.deadlineTime : null,
        penalty_points: formData.penalty_points,
        task_type: formData.taskType,
        transferable: formData.taskType === 'negotiable',
        is_hanging: formData.assigned_to === 'hanging',
        hanging_expires_at: hangingExpiresAt,
        is_strict: formData.is_strict
      }, user.id, user.family_id)
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        points: 5,
        assigned_to: '',
        dueDate: '',
        deadlineTime: '23:59',
        penalty_points: 0,
        task_type: 'non_negotiable',
        transferable: false,
        taskType: 'non_negotiable',
        hangingExpiresDate: '',
        hangingExpiresTime: '10:00',
        is_strict: false
      })
      setShowForm(false)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setCreating(false)
    }
  }

  const handleCreateRecurringTask = async (taskData: CreateTaskData) => {
    if (!user) return
    
    setProcessing(true)
    try {
      await createTask(taskData, user.id, user.family_id)
      setShowRecurringModal(false)
    } catch (error: any) {
      // Server-side validation errors should not happen with client-side validation
      // But keep this as backup for other types of errors
      console.error('Error creating recurring task:', error)
      console.error('Error message:', error?.message)
      console.error('Error details:', error?.details || error?.hint || error?.code)
    } finally {
      setProcessing(false)
    }
  }

  // Helper function to check if task is recurring
  const isRecurringTask = (task: Task): boolean => {
    return (task.is_recurring && !task.parent_task_id) || // Template
           (!task.is_recurring && !!task.parent_task_id)   // Instance from recurring template
  }

  // Helper function to check if a recurring task instance is the latest in its series
  const isLatestRecurringTask = (task: Task): boolean => {
    // Only instances can be "latest" (not templates)
    if (task.is_recurring || !task.parent_task_id) return false
    
    // Find all instances from the same series
    const sameSeriesInstances = tasks.filter(t => 
      !t.is_recurring && 
      t.parent_task_id === task.parent_task_id
    )
    
    // Sort by sequence_number to find the latest one (highest sequence number)
    const sortedInstances = sameSeriesInstances.sort((a, b) => 
      (b.sequence_number || 0) - (a.sequence_number || 0)
    )
    
    // Check if this task is the latest (first in sorted array)
    return sortedInstances[0]?.id === task.id
  }

  const handleReviewTask = (task: Task) => {
    setSelectedTask(task)
    
    // Check if this is a strict task that needs special handling
    if (shouldShowStrictTaskReviewModal(task)) {
      setShowStrictReviewModal(true)
    } else {
      setShowReviewModal(true)
    }
  }

  const handleEditTask = (task: Task) => {
    setSelectedTask(task)
    
    // Check if it's a recurring task
    if (isRecurringTask(task)) {
      setRecurringActionType('edit')
      setShowRecurringActionModal(true)
    } else {
      setShowEditModal(true)
    }
  }

  const handleDeleteTask = (task: Task) => {
    setSelectedTask(task)
    setIntendedAction('delete') // Set intent for single delete
    
    // Check if it's a recurring task
    if (isRecurringTask(task)) {
      // For paused/disabled recurring tasks, skip the choice modal and go straight to confirmation
      const isDisabledRecurring = (task.is_recurring && task.parent_task_id === null && task.is_recurring_enabled === false) ||
                                  (!task.is_recurring && task.parent_task_id && task.template_recurring_enabled === false)
      
      if (isDisabledRecurring) {
        // For paused recurring tasks, show direct deletion confirmation
        setShowDeleteModal(true)
      } else {
        // For active recurring tasks, show choice modal (this or all upcoming)
        setRecurringActionType('delete')
        setShowRecurringActionModal(true)
      }
    } else {
      setShowDeleteModal(true)
    }
  }

  // Handler for single recurring task action (only this one)
  const handleRecurringSingleAction = () => {
    if (!selectedTask) return
    
    if (recurringActionType === 'edit') {
      // Close recurring modal and open regular edit modal for this task only
      setEditAllUpcoming(false)
      setShowRecurringActionModal(false)
      setShowEditModal(true)
    } else if (recurringActionType === 'delete') {
      // Close recurring modal and open regular delete modal for this task only
      setShowRecurringActionModal(false)
      setShowDeleteModal(true)
    }
  }

  // Handler for all upcoming recurring tasks action
  const handleRecurringAllUpcomingAction = async () => {
    if (!selectedTask) return
    
    setProcessing(true)
    try {
      if (recurringActionType === 'edit') {
        // For edit all upcoming, we'll open the edit modal with the flag set
        setEditAllUpcoming(true)
        setShowRecurringActionModal(false)
        setShowEditModal(true)
        setProcessing(false) // Reset processing since we're opening the edit modal
      } else if (recurringActionType === 'delete') {
        // Delete all upcoming recurring tasks
        await deleteTask(selectedTask.id, true) // true = delete all upcoming
        setShowRecurringActionModal(false)
        setSelectedTask(null)
        toast.success('Recurring task series deleted successfully')
      }
    } catch (error) {
      console.error('Error handling recurring task action:', error)
      toast.error(`Failed to ${recurringActionType} recurring task series`)
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkAction = (action: 'delete' | 'archive') => {
    const tasksToProcess = tasks.filter(task => selectedTasks.includes(task.id))
    setSelectedTask(null)
    setIntendedAction(action) // Set the intended action
    setShowDeleteModal(true)
  }

  const handleApproveTask = async () => {
    if (!selectedTask) return

    setProcessing(true)
    try {
      await approveTask(selectedTask.id, selectedTask.assigned_to, selectedTask.points)
    } catch (error) {
      // Error handling done in hook
    } finally {
      setProcessing(false)
    }
  }

  const handleRejectTask = async (reason: string) => {
    if (!selectedTask) return

    setProcessing(true)
    try {
      await rejectTask(selectedTask.id, reason)
    } catch (error) {
      // Error handling done in hook
    } finally {
      setProcessing(false)
    }
  }

  // Strict task review handlers
  const handleStrictApprove = async () => {
    if (!selectedTask) return

    setProcessing(true)
    try {
      await approveTask(selectedTask.id, selectedTask.assigned_to, selectedTask.points)
    } catch (error) {
      // Error handling done in hook
    } finally {
      setProcessing(false)
    }
  }

  const handleStrictRejectWithGrace = async (hours: number, reason: string) => {
    if (!selectedTask) return

    setProcessing(true)
    try {
      // Extend deadline by specified hours
      const newDeadline = new Date()
      newDeadline.setHours(newDeadline.getHours() + hours)
      
      // Update the task with new deadline
      await updateTask(selectedTask.id, {
        due_date: newDeadline.toISOString(),
        rejection_reason: reason
      })
      
      // Reject the task so child can resubmit
      await rejectTask(selectedTask.id, reason)
    } catch (error) {
      // Error handling done in hook
    } finally {
      setProcessing(false)
    }
  }

  const handleStrictRejectWithPenalty = async (reason: string) => {
    if (!selectedTask) return

    setProcessing(true)
    try {
      await rejectTask(selectedTask.id, reason)
      // Note: The existing rejectTask should handle penalty logic
    } catch (error) {
      // Error handling done in hook
    } finally {
      setProcessing(false)
    }
  }

  const handleEditSave = async (taskData: Partial<CreateTaskData>) => {
    if (!selectedTask) return

    setProcessing(true)
    try {
      // Pass the editAllUpcoming flag if it's a recurring task
      const isRecurring = isRecurringTask(selectedTask)
      if (isRecurring) {
        await updateTask(selectedTask.id, taskData, editAllUpcoming)
      } else {
        await updateTask(selectedTask.id, taskData)
      }
      
      // Reset the flag after saving
      setEditAllUpcoming(false)
    } catch (error) {
      // Error handling done in hook
    } finally {
      setProcessing(false)
    }
  }

  const handleToggleEnabled = async (task: Task, enabled: boolean) => {
    setProcessing(true)
    try {
      // For recurring instances, we need to work with the template
      const isInstance = !task.is_recurring && task.parent_task_id
      
      let targetTask: Task | undefined
      
      if (isInstance) {
        // Instance: Need to fetch the template since it might be filtered out from view
        try {
          const { data } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', task.parent_task_id)
            .single()
          
          targetTask = data
        } catch (error) {
          console.error('Error fetching template:', error)
        }
      } else {
        // Template: Use the task itself
        targetTask = task
      }
      
      if (!targetTask) {
        toast.error('Could not find recurring template')
        setProcessing(false)
        return
      }
      
      console.log('🔄 Page: Toggle enabled called', {
        originalTaskId: task.id,
        originalTaskStatus: task.status,
        originalTaskApprovedAt: task.approved_at,
        isInstance,
        targetTaskId: targetTask.id,
        currentEnabled: targetTask.is_recurring_enabled,
        requestedEnabled: enabled
      })
      
      // Validate if re-enabling and check 30-minute rule
      if (enabled && !targetTask.is_recurring_enabled) {
        // Validate that the next task instance would be at least 30 minutes in the future
        const now = new Date()
        const minFutureTime = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes from now
        
        // Get the task's timing
        const timeString = targetTask.recurring_time || '23:59'
        const [hours, minutes] = timeString.split(':').map(Number)
        
        let nextTaskTime: Date
        
        switch (targetTask.recurring_pattern) {
          case 'daily':
            const targetTimeToday = new Date()
            targetTimeToday.setHours(hours, minutes, 0, 0)
            
            if (targetTimeToday > now) {
              nextTaskTime = targetTimeToday
            } else {
              nextTaskTime = new Date()
              nextTaskTime.setDate(nextTaskTime.getDate() + 1)
              nextTaskTime.setHours(hours, minutes, 0, 0)
            }
            break
            
          case 'weekly':
            const currentDay = now.getDay()
            const targetWeekDay = targetTask.recurring_day_of_week || 1
            let daysUntilTarget = (targetWeekDay - currentDay + 7) % 7
            
            if (daysUntilTarget === 0) {
              const targetTimeToday = new Date()
              targetTimeToday.setHours(hours, minutes, 0, 0)
              
              if (targetTimeToday > now) {
                nextTaskTime = targetTimeToday
              } else {
                nextTaskTime = new Date()
                nextTaskTime.setDate(nextTaskTime.getDate() + 7)
                nextTaskTime.setHours(hours, minutes, 0, 0)
              }
            } else {
              nextTaskTime = new Date()
              nextTaskTime.setDate(nextTaskTime.getDate() + daysUntilTarget)
              nextTaskTime.setHours(hours, minutes, 0, 0)
            }
            break
            
          case 'monthly':
            const currentMonth = now.getMonth()
            const currentYear = now.getFullYear()
            const targetMonthDay = targetTask.recurring_day_of_month || 1
            
            const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
            const actualTargetDay = Math.min(targetMonthDay, lastDayOfMonth)
            
            const targetDateThisMonth = new Date(currentYear, currentMonth, actualTargetDay)
            targetDateThisMonth.setHours(hours, minutes, 0, 0)
            
            if (targetDateThisMonth > now) {
              nextTaskTime = targetDateThisMonth
            } else {
              const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
              const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear
              
              const lastDayOfNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate()
              const nextActualTargetDay = Math.min(targetMonthDay, lastDayOfNextMonth)
              
              nextTaskTime = new Date(nextYear, nextMonth, nextActualTargetDay)
              nextTaskTime.setHours(hours, minutes, 0, 0)
            }
            break
            
          default:
            // Fallback to tomorrow
            nextTaskTime = new Date()
            nextTaskTime.setDate(nextTaskTime.getDate() + 1)
            nextTaskTime.setHours(hours, minutes, 0, 0)
        }
        
        if (nextTaskTime <= minFutureTime) {
          const timeUntilNext = Math.round((nextTaskTime.getTime() - now.getTime()) / (1000 * 60))
          toast.error(`Cannot enable: Next task would be in ${timeUntilNext} minutes. Tasks must be at least 30 minutes in the future.`)
          setProcessing(false)
          return
        }
      }
      
      console.log('🔧 Page: Updating template with enabled status:', enabled)
      await updateTask(targetTask.id, { is_recurring_enabled: enabled })
      
      // TODO: Optimize this to avoid full page refresh
      console.log('🔄 Page: Refetching tasks after template update')
      await refetchTasks()
      
      toast.success(`Recurring task ${enabled ? 'enabled' : 'disabled'} successfully`)
    } catch (error) {
      console.error('Error toggling task enabled state:', error)
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} recurring task`)
    } finally {
      setProcessing(false)
    }
  }

  const handleDeleteConfirm = async () => {
    console.log('🔄 Page: Delete confirm called')
    console.log('📋 Selected tasks for bulk:', selectedTasks)
    console.log('📋 Selected single task:', selectedTask?.id)
    
    setProcessing(true)
    try {
      if (selectedTasks.length > 0) {
        // BULK DELETE: Only delete the deletable tasks from selection
        const selectedTasksData = tasks.filter(task => selectedTasks.includes(task.id))
        const deletableTasks = selectedTasksData.filter(task => canDeleteTask(task))
        const deletableTaskIds = deletableTasks.map(task => task.id)
        
        console.log('🔄 Page: Performing bulk delete on deletable tasks only:', deletableTaskIds)
        
        if (deletableTaskIds.length > 0) {
          await deleteTasks(deletableTaskIds)
          
          // Refresh the task list to show changes immediately
          await refetchTasks()
          
          // Remove only the deleted task IDs from selected tasks
          setSelectedTasks(prev => prev.filter(id => !deletableTaskIds.includes(id)))
          
          // If no more tasks are selected, exit bulk mode
          const remainingSelected = selectedTasks.filter(id => !deletableTaskIds.includes(id))
          if (remainingSelected.length === 0) {
            setBulkMode(false)
          }
        } else {
          console.warn('⚠️ No deletable tasks in selection')
        }
        
        console.log('✅ Page: Bulk delete completed')
      } else if (selectedTask) {
        // SINGLE DELETE
        console.log('🔄 Page: Performing single delete:', selectedTask.id)
        const isRecurring = isRecurringTask(selectedTask)
        
        if (isRecurring) {
          // Check what type of recurring task this is
          const isTemplate = selectedTask.is_recurring && selectedTask.parent_task_id === null
          const isInstance = !selectedTask.is_recurring && selectedTask.parent_task_id !== null
          const isDisabledRecurringTemplate = isTemplate && selectedTask.is_recurring_enabled === false
          
          console.log('🔄 Page: Recurring task details:', {
            taskId: selectedTask.id,
            title: selectedTask.title,
            is_recurring: selectedTask.is_recurring,
            parent_task_id: selectedTask.parent_task_id,
            is_recurring_enabled: selectedTask.is_recurring_enabled,
            isTemplate,
            isInstance,
            isDisabledRecurringTemplate
          })
          
          if (isDisabledRecurringTemplate || isInstance) {
            // For paused templates OR instances: stop future generation and delete current task
            const actionDescription = isTemplate ? 'disabled template and future tasks' : 'current task and stop future generation'
            console.log(`🔄 Page: Deleting ${actionDescription}`)
            console.log('🔄 Page: Calling tasksService.deleteRecurringTask with:', { taskId: selectedTask.id, deleteAllUpcoming: true })
            
            try {
              console.log('🔍 Page: Checking tasksService object:', tasksService)
              console.log('🔍 Page: deleteRecurringTask function exists?', typeof tasksService.deleteRecurringTask)
              
              if (typeof tasksService.deleteRecurringTask === 'function') {
                // Use the specialized function if available
                await tasksService.deleteRecurringTask(selectedTask.id, true) // deleteAllUpcoming = true
                console.log('✅ Page: Successfully deleted recurring template using deleteRecurringTask')
              } else {
                // Fallback to regular deleteTask with deleteAllUpcoming parameter
                console.log('🔄 Page: Falling back to regular deleteTask with deleteAllUpcoming=true')
                await deleteTask(selectedTask.id, true) // true = delete all upcoming
                console.log('✅ Page: Successfully deleted recurring template using deleteTask fallback')
              }
              
              // Refresh the task list to show changes immediately
              console.log('🔄 Page: Refreshing task list after successful deletion')
              await refetchTasks()
              
              toast.success('Recurring task stopped successfully (completed tasks preserved)')
            } catch (deleteError) {
              console.error('❌ Page: Error deleting paused recurring task:', deleteError)
              throw deleteError // Re-throw to be caught by outer catch
            }
          } else {
            // For regular recurring tasks, explicitly pass false to delete only this one
            console.log('🔄 Page: Deleting single recurring task instance')
            await deleteTask(selectedTask.id, false)
            await refetchTasks()
          }
        } else {
          // For regular tasks, use normal delete
          await deleteTask(selectedTask.id)
          await refetchTasks()
        }
        console.log('✅ Page: Single delete completed')
      } else {
        console.warn('⚠️ Page: No tasks selected for deletion')
      }
    } catch (error: any) {
      console.error('❌ Page: Delete confirm error:', {
        message: error?.message || 'Unknown error',
        error,
        errorString: error?.toString?.() || 'No string representation',
        errorStack: error?.stack || 'No stack trace',
        selectedTasks,
        selectedTaskId: selectedTask?.id,
        selectedTaskDetails: selectedTask ? {
          id: selectedTask.id,
          title: selectedTask.title,
          is_recurring: selectedTask.is_recurring,
          parent_task_id: selectedTask.parent_task_id,
          is_recurring_enabled: selectedTask.is_recurring_enabled
        } : null
      })
      toast.error(`Failed to delete task: ${error?.message || 'Unknown error'}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleArchiveConfirm = async () => {
    console.log('🔄 Page: Archive confirm called')
    console.log('📋 Selected tasks for bulk:', selectedTasks)
    console.log('📋 Selected single task:', selectedTask?.id)
    
    setProcessing(true)
    try {
      if (selectedTasks.length > 0) {
        // BULK ARCHIVE: Only archive the archivable tasks from selection
        const selectedTasksData = tasks.filter(task => selectedTasks.includes(task.id))
        const archivableTasks = selectedTasksData.filter(task => canArchiveTask(task))
        const archivableTaskIds = archivableTasks.map(task => task.id)
        
        console.log('🔄 Page: Performing bulk archive on archivable tasks only:', archivableTaskIds)
        
        if (archivableTaskIds.length > 0) {
          await archiveTasks(archivableTaskIds)
          
          // Remove only the archived task IDs from selected tasks
          setSelectedTasks(prev => prev.filter(id => !archivableTaskIds.includes(id)))
          
          // If no more tasks are selected, exit bulk mode
          const remainingSelected = selectedTasks.filter(id => !archivableTaskIds.includes(id))
          if (remainingSelected.length === 0) {
            setBulkMode(false)
          }
        } else {
          console.warn('⚠️ No archivable tasks in selection')
        }
        
        console.log('✅ Page: Bulk archive completed')
      } else if (selectedTask) {
        // SINGLE ARCHIVE
        console.log('🔄 Page: Performing single archive:', selectedTask.id)
        await archiveTask(selectedTask.id)
        console.log('✅ Page: Single archive completed')
      } else {
        console.warn('⚠️ Page: No tasks selected for archiving')
      }
    } catch (error: any) {
      console.error('❌ Page: Archive confirm error:', {
        message: error?.message || 'Unknown error',
        error,
        selectedTasks,
        selectedTaskId: selectedTask?.id
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleTaskSelect = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTasks(prev => [...prev, taskId])
    } else {
      setSelectedTasks(prev => prev.filter(id => id !== taskId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(tasks.map(task => task.id))
    } else {
      setSelectedTasks([])
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-purple-100 text-purple-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleModalClose = () => {
    setShowDeleteModal(false)
    setSelectedTask(null)
    setIntendedAction(null) // Clear the intent when closing
    setEditAllUpcoming(false) // Reset the edit all upcoming flag
  }

  // Get bulk action info
  const selectedTasksData = tasks.filter(task => selectedTasks.includes(task.id))
  const canDeleteSelected = selectedTasksData.some(task => canDeleteTask(task))
  const canArchiveSelected = selectedTasksData.some(task => canArchiveTask(task))

  if (!user) return null

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    )
  }

  const tasksToDelete = selectedTask ? [selectedTask] : selectedTasksData
  const tasksToProcess = selectedTask ? [selectedTask] : tasks.filter(task => selectedTasks.includes(task.id))

  return (
    <>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Mobile Header */}
        <div className="flex justify-between items-center mb-6 md:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
            <p className="text-sm text-gray-600">Create and manage tasks</p>
          </div>
          <Link href="/dashboard/parent">
            <Button variant="outline">← Back</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Filters */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Expired Hanging Tasks */}
            {user?.family_id && (
              <ExpiredHangingTasksCard
                familyId={user.family_id}
                children={childrenList}
                onTaskUpdate={() => window.location.reload()}
              />
            )}

            {/* Filters */}
            <TaskFilters
              filters={filters}
              onFiltersChange={updateFilters}
              onClearFilters={clearFilters}
              children={childrenList}
              isParent={true}
              stats={stats}
            />

            {/* Create Task Form - Mobile Only */}
            <div className="block lg:hidden">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    📝 Create New Task
                    {!showForm && (
                      <div className="flex items-center space-x-1">
                        <Button size="sm" onClick={() => setShowForm(true)}>
                          + One-time
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowRecurringModal(true)}>
                          🔄 Recurring
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                {showForm && (
                  <CardContent>
                    <form onSubmit={handleCreateTask} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Task Title</Label>
                        <Input
                          id="title"
                          placeholder="Clean your room"
                          value={formData.title}
                          onChange={(e) => setFormData({...formData, title: e.target.value})}
                          required
                          disabled={creating}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          placeholder="Put away clothes..."
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          disabled={creating}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="points">Reward Points</Label>
                          <Select 
                            value={formData.points.toString()} 
                            onValueChange={(value) => setFormData({...formData, points: parseInt(value)})}
                            disabled={creating}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 point</SelectItem>
                              <SelectItem value="3">3 points</SelectItem>
                              <SelectItem value="5">5 points</SelectItem>
                              <SelectItem value="10">10 points</SelectItem>
                              <SelectItem value="15">15 points</SelectItem>
                              <SelectItem value="20">20 points</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="penaltyPoints">Penalty Points</Label>
                          <Select 
                            value={formData.penalty_points.toString()} 
                            onValueChange={(value) => setFormData({...formData, penalty_points: parseInt(value)})}
                            disabled={creating}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">No penalty</SelectItem>
                              <SelectItem value="1">1 point</SelectItem>
                              <SelectItem value="3">3 points</SelectItem>
                              <SelectItem value="5">5 points</SelectItem>
                              <SelectItem value="10">10 points</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="dueDate">Due Date</Label>
                          <Input
                            id="dueDate"
                            type="date"
                            value={formData.dueDate}
                            onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                            disabled={creating}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="deadlineTime">Deadline Time</Label>
                          <Input
                            id="deadlineTime"
                            type="time"
                            value={formData.deadlineTime}
                            onChange={(e) => setFormData({...formData, deadlineTime: e.target.value})}
                            disabled={creating || !formData.dueDate}
                            className={!formData.dueDate ? "opacity-50 cursor-not-allowed" : ""}
                            onClick={() => {
                              if (!formData.dueDate) {
                                toast.error('Please choose a due date first')
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="taskType">Task Type</Label>
                        <Select 
                          value={formData.taskType} 
                          onValueChange={(value: 'negotiable' | 'non_negotiable') => 
                            setFormData({...formData, taskType: value})
                          }
                          disabled={creating}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="non_negotiable">🔒 Non-Negotiable</SelectItem>
                            <SelectItem value="negotiable">🤝 Negotiable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="assignedTo">Assign To</Label>
                        <Select 
                          value={formData.assigned_to} 
                          onValueChange={(value) => {
                            const updates: any = { assigned_to: value }
                            // Set default hanging expires date when hanging is selected
                            if (value === 'hanging' && !formData.hangingExpiresDate) {
                              const defaultDate = new Date()
                              defaultDate.setDate(defaultDate.getDate() + 7) // 7 days from now
                              updates.hangingExpiresDate = defaultDate.toISOString().split('T')[0]
                            }
                            setFormData({...formData, ...updates})
                          }}
                          disabled={creating}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select child or hanging" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hanging">📌 Hanging Task</SelectItem>
                            {childrenList.map((child) => (
                              <SelectItem key={child.id} value={child.id}>
                                {child.name} ({child.points} points)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.assigned_to === 'hanging' && (
                        <>
                          <div className="bg-orange-50 p-3 rounded-lg">
                            <p className="text-sm text-orange-700">
                              📌 <strong>Hanging Task:</strong> This task will be available for any child to pick up. 
                              It can be {formData.taskType === 'negotiable' ? 'negotiable' : 'non-negotiable'} once claimed.
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="hangingExpiresDate">Valid Until Date</Label>
                              <Input
                                id="hangingExpiresDate"
                                type="date"
                                value={formData.hangingExpiresDate}
                                onChange={(e) => {
                                  const selectedDate = new Date(e.target.value)
                                  const today = new Date()
                                  today.setHours(0, 0, 0, 0)
                                  
                                  // Set default to 7 days from now if not set
                                  if (!formData.hangingExpiresDate) {
                                    const defaultDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
                                    setFormData({
                                      ...formData, 
                                      hangingExpiresDate: e.target.value || defaultDate.toISOString().split('T')[0]
                                    })
                                  } else {
                                    setFormData({...formData, hangingExpiresDate: e.target.value})
                                  }
                                }}
                                disabled={creating}
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="hangingExpiresTime">Valid Until Time</Label>
                              <Input
                                id="hangingExpiresTime"
                                type="time"
                                value={formData.hangingExpiresTime}
                                onChange={(e) => setFormData({...formData, hangingExpiresTime: e.target.value})}
                                disabled={creating}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Strict Task Checkbox */}
                      <div className="flex items-center space-x-2 p-3 border rounded-lg">
                        <Checkbox
                          id="isStrict"
                          checked={formData.is_strict}
                          onCheckedChange={(checked) => setFormData({...formData, is_strict: checked as boolean})}
                          disabled={creating}
                        />
                        <div className="flex flex-col">
                          <Label htmlFor="isStrict" className="text-sm font-medium">
                            🔒 Forbid submissions after deadline
                          </Label>
                          <p className="text-xs text-gray-600">
                            Task becomes locked and unsubmittable once deadline passes
                          </p>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button type="submit" disabled={creating} className="flex-1">
                          {creating ? 'Creating...' : 'Create'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </form>

                    {childrenList.length === 0 && (
                      <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-700">
                          No children found. Add children first!
                        </p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>

          </div>

          {/* Tasks List */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Create Task Form - Desktop Only */}
            <div className="hidden lg:block">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    📝 Create New Task
                    {!showForm && (
                      <div className="flex items-center space-x-1">
                        <Button size="sm" onClick={() => setShowForm(true)}>
                          + One-time
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowRecurringModal(true)}>
                          🔄 Recurring
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                {showForm && (
                  <CardContent>
                    <form onSubmit={handleCreateTask} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="title-desktop">Task Title</Label>
                          <Input
                            id="title-desktop"
                            placeholder="Clean your room"
                            value={formData.title}
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                            required
                            disabled={creating}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description-desktop">Description</Label>
                          <Input
                            id="description-desktop"
                            placeholder="Put away clothes..."
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            disabled={creating}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="points-desktop">Reward Points</Label>
                          <Select 
                            value={formData.points.toString()} 
                            onValueChange={(value) => setFormData({...formData, points: parseInt(value)})}
                            disabled={creating}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 point</SelectItem>
                              <SelectItem value="3">3 points</SelectItem>
                              <SelectItem value="5">5 points</SelectItem>
                              <SelectItem value="10">10 points</SelectItem>
                              <SelectItem value="15">15 points</SelectItem>
                              <SelectItem value="20">20 points</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="penaltyPoints-desktop">Penalty Points</Label>
                          <Select 
                            value={formData.penalty_points.toString()} 
                            onValueChange={(value) => setFormData({...formData, penalty_points: parseInt(value)})}
                            disabled={creating}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">No penalty</SelectItem>
                              <SelectItem value="1">1 point</SelectItem>
                              <SelectItem value="3">3 points</SelectItem>
                              <SelectItem value="5">5 points</SelectItem>
                              <SelectItem value="10">10 points</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dueDate-desktop">Due Date</Label>
                          <Input
                            id="dueDate-desktop"
                            type="date"
                            value={formData.dueDate}
                            onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                            disabled={creating}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="deadlineTime-desktop">Deadline Time</Label>
                          <Input
                            id="deadlineTime-desktop"
                            type="time"
                            value={formData.deadlineTime}
                            onChange={(e) => setFormData({...formData, deadlineTime: e.target.value})}
                            disabled={creating || !formData.dueDate}
                            className={!formData.dueDate ? "opacity-50 cursor-not-allowed" : ""}
                            onClick={() => {
                              if (!formData.dueDate) {
                                toast.error('Please choose a due date first')
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="taskType-desktop">Task Type</Label>
                          <Select 
                            value={formData.taskType} 
                            onValueChange={(value: 'negotiable' | 'non_negotiable') => 
                              setFormData({...formData, taskType: value})
                            }
                            disabled={creating}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="non_negotiable">🔒 Non-Negotiable</SelectItem>
                              <SelectItem value="negotiable">🤝 Negotiable</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="assignedTo-desktop">Assign To</Label>
                          <Select 
                            value={formData.assigned_to} 
                            onValueChange={(value) => {
                              const updates: any = { assigned_to: value }
                              // Set default hanging expires date when hanging is selected
                              if (value === 'hanging' && !formData.hangingExpiresDate) {
                                const defaultDate = new Date()
                                defaultDate.setDate(defaultDate.getDate() + 7) // 7 days from now
                                updates.hangingExpiresDate = defaultDate.toISOString().split('T')[0]
                              }
                              setFormData({...formData, ...updates})
                            }}
                            disabled={creating}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select child or hanging" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hanging">📌 Hanging Task</SelectItem>
                              {childrenList.map((child) => (
                                <SelectItem key={child.id} value={child.id}>
                                  {child.name} ({child.points} points)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {formData.assigned_to === 'hanging' && (
                        <>
                          <div className="bg-orange-50 p-3 rounded-lg">
                            <p className="text-sm text-orange-700">
                              📌 <strong>Hanging Task:</strong> This task will be available for any child to pick up. 
                              It can be {formData.taskType === 'negotiable' ? 'negotiable' : 'non-negotiable'} once claimed.
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="hangingExpiresDate-desktop">Valid Until Date</Label>
                              <Input
                                id="hangingExpiresDate-desktop"
                                type="date"
                                value={formData.hangingExpiresDate}
                                onChange={(e) => {
                                  const selectedDate = new Date(e.target.value)
                                  const today = new Date()
                                  today.setHours(0, 0, 0, 0)
                                  
                                  // Set default to 7 days from now if not set
                                  if (!formData.hangingExpiresDate) {
                                    const defaultDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
                                    setFormData({
                                      ...formData, 
                                      hangingExpiresDate: e.target.value || defaultDate.toISOString().split('T')[0]
                                    })
                                  } else {
                                    setFormData({...formData, hangingExpiresDate: e.target.value})
                                  }
                                }}
                                disabled={creating}
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="hangingExpiresTime-desktop">Valid Until Time</Label>
                              <Input
                                id="hangingExpiresTime-desktop"
                                type="time"
                                value={formData.hangingExpiresTime}
                                onChange={(e) => setFormData({...formData, hangingExpiresTime: e.target.value})}
                                disabled={creating}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Strict Task Checkbox */}
                      <div className="flex items-center space-x-2 p-3 border rounded-lg">
                        <Checkbox
                          id="isStrict-desktop"
                          checked={formData.is_strict}
                          onCheckedChange={(checked) => setFormData({...formData, is_strict: checked as boolean})}
                          disabled={creating}
                        />
                        <div className="flex flex-col">
                          <Label htmlFor="isStrict-desktop" className="text-sm font-medium">
                            🔒 Forbid submissions after deadline
                          </Label>
                          <p className="text-xs text-gray-600">
                            Task becomes locked and unsubmittable once deadline passes
                          </p>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button type="submit" disabled={creating} className="flex-1">
                          {creating ? 'Creating...' : 'Create'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </form>

                    {childrenList.length === 0 && (
                      <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-700">
                          No children found. Add children first!
                        </p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  📋 Family Tasks
                  <div className="flex items-center space-x-2">
                    {tasks.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBulkMode(!bulkMode)}
                      >
                        {bulkMode ? 'Cancel' : 'Select Multiple'}
                      </Button>
                    )}
                    {bulkMode && selectedTasks.length > 0 && (
                      <div className="flex items-center space-x-1">
                        {canDeleteSelected && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleBulkAction('delete')} // This sets intent to 'delete'
                          >
                            Delete ({selectedTasksData.filter(task => canDeleteTask(task)).length})
                          </Button>
                        )}
                        {canArchiveSelected && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBulkAction('archive')} // This sets intent to 'archive'
                          >
                            Archive ({selectedTasksData.filter(task => canArchiveTask(task)).length})
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  {tasks.length} tasks shown
                  {bulkMode && (
                    <span className="ml-2 text-blue-600">
                      • Select tasks for bulk actions
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tasks.length > 0 ? (
                  <div className="space-y-4">
                    {/* Select All in Bulk Mode */}
                    {bulkMode && (
                      <div className="flex items-center space-x-2 pb-2 border-b">
                        <Checkbox
                          id="selectAll"
                          checked={selectedTasks.length === tasks.length}
                          onCheckedChange={handleSelectAll}
                        />
                        <label htmlFor="selectAll" className="text-sm cursor-pointer">
                          Select All ({tasks.length} tasks)
                        </label>
                      </div>
                    )}

                    {tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        bulkMode={bulkMode}
                        selectedTasks={selectedTasks}
                        onTaskSelect={handleTaskSelect}
                        onReviewTask={handleReviewTask}
                        onEditTask={handleEditTask}
                        onDeleteTask={handleDeleteTask}
                        onToggleEnabled={handleToggleEnabled}
                        onArchiveTask={(task) => {
                          setSelectedTask(task)
                          setIntendedAction('archive')
                          setShowDeleteModal(true)
                        }}
                        canEditTask={canEditTask}
                        canDeleteTask={canDeleteTask}
                        canArchiveTask={canArchiveTask}
                        getStatusColor={getStatusColor}
                        isLatestRecurringTask={isLatestRecurringTask(task)}
                        templateRecurringEnabled={
                          // For instances, use the enriched template status from service
                          !task.is_recurring && task.parent_task_id
                            ? task.template_recurring_enabled
                            : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No tasks match your filters</p>
                    <p className="text-sm text-gray-400 mt-2">Try adjusting your filters or create a new task!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* Modals */}
      {selectedTask && (
        <TaskReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false)
            setSelectedTask(null)
          }}
          onApprove={handleApproveTask}
          onReject={handleRejectTask}
          task={selectedTask}
          processing={processing}
        />
      )}

      {selectedTask && (
        <StrictTaskReviewModal
          isOpen={showStrictReviewModal}
          onClose={() => {
            setShowStrictReviewModal(false)
            setSelectedTask(null)
          }}
          onApprove={handleStrictApprove}
          onRejectWithGrace={handleStrictRejectWithGrace}
          onRejectWithPenalty={handleStrictRejectWithPenalty}
          task={selectedTask}
          processing={processing}
        />
      )}

      <TaskEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedTask(null)
        }}
        onSave={handleEditSave}
        task={selectedTask}
        children={childrenList}
        saving={processing}
      />

      <TaskDeleteModal
        isOpen={showDeleteModal}
        onClose={handleModalClose} // Use the new close handler
        onDelete={handleDeleteConfirm}
        onArchive={handleArchiveConfirm}
        tasks={tasksToProcess}
        processing={processing}
        preferredAction={intendedAction} // Pass the intended action
      />

      <RecurringTaskModal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        onSave={handleCreateRecurringTask}
        children={childrenList}
        saving={processing}
      />

      <RecurringTaskActionModal
        isOpen={showRecurringActionModal}
        onClose={() => {
          setShowRecurringActionModal(false)
          setSelectedTask(null)
        }}
        onSingleAction={handleRecurringSingleAction}
        onAllUpcomingAction={handleRecurringAllUpcomingAction}
        task={selectedTask}
        actionType={recurringActionType}
        processing={processing}
      />

    </>
  )
}
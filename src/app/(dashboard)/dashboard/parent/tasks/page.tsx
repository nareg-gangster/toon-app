'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/hooks/useTasks'
import { useFamilyMembers } from '@/hooks/useFamilyMembers'
import { CreateTaskData, Task } from '@/types'
import TaskReviewModal from '@/components/tasks/TaskReviewModal'
import TaskEditModal from '@/components/tasks/TaskEditModal'
import TaskDeleteModal from '@/components/tasks/TaskDeleteModal'
import TaskFilters from '@/components/tasks/TaskFilters'
import { Edit3, Trash2, Archive } from 'lucide-react'
import Link from 'next/link'

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
    getFilterStats
  } = useTasks(user?.family_id)
  
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [intendedAction, setIntendedAction] = useState<'delete' | 'archive' | null>(null)

  
  const [formData, setFormData] = useState<CreateTaskData & { dueDate: string }>({
    title: '',
    description: '',
    points: 5,
    assigned_to: '',
    dueDate: ''
  })

  useEffect(() => {
    requireAuth('parent')
  }, [])

  const childrenList = children.filter(member => member.role === 'child')
  const stats = getFilterStats()

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.assigned_to) return

    setCreating(true)
    try {
      await createTask({
        title: formData.title,
        description: formData.description,
        points: formData.points,
        assigned_to: formData.assigned_to,
        due_date: formData.dueDate || null
      }, user.id, user.family_id)
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        points: 5,
        assigned_to: '',
        dueDate: ''
      })
      setShowForm(false)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setCreating(false)
    }
  }

  const handleReviewTask = (task: Task) => {
    setSelectedTask(task)
    setShowReviewModal(true)
  }

  const handleEditTask = (task: Task) => {
    setSelectedTask(task)
    setShowEditModal(true)
  }

  const handleDeleteTask = (task: Task) => {
    setSelectedTask(task)
    setIntendedAction('delete') // Set intent for single delete
    setShowDeleteModal(true)
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

  const handleEditSave = async (taskData: Partial<CreateTaskData>) => {
    if (!selectedTask) return

    setProcessing(true)
    try {
      await updateTask(selectedTask.id, taskData)
    } catch (error) {
      // Error handling done in hook
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
        await deleteTask(selectedTask.id)
        console.log('✅ Page: Single delete completed')
      } else {
        console.warn('⚠️ Page: No tasks selected for deletion')
      }
    } catch (error: any) {
      console.error('❌ Page: Delete confirm error:', {
        message: error?.message || 'Unknown error',
        error,
        selectedTasks,
        selectedTaskId: selectedTask?.id
      })
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
          
          {/* Filters & Create Task */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Filters */}
            <TaskFilters
              filters={filters}
              onFiltersChange={updateFilters}
              onClearFilters={clearFilters}
              children={childrenList}
              isParent={true}
              stats={stats}
            />

            {/* Create Task Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  📝 Create New Task
                  {!showForm && (
                    <Button size="sm" onClick={() => setShowForm(true)}>
                      + New
                    </Button>
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

                    <div className="space-y-2">
                      <Label htmlFor="points">Points</Label>
                      <Select 
                        value={formData.points.toString()} 
                        onValueChange={(value) => setFormData({...formData, points: parseInt(value)})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 point</SelectItem>
                          <SelectItem value="3">3 points</SelectItem>
                          <SelectItem value="5">5 points</SelectItem>
                          <SelectItem value="10">10 points</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

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
                      <Label htmlFor="assignedTo">Assign To</Label>
                      <Select 
                        value={formData.assigned_to} 
                        onValueChange={(value) => setFormData({...formData, assigned_to: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select child" />
                        </SelectTrigger>
                        <SelectContent>
                          {childrenList.map((child) => (
                            <SelectItem key={child.id} value={child.id}>
                              {child.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

          {/* Tasks List */}
          <div className="lg:col-span-3">
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
                      <div key={task.id} className={`border rounded-lg p-4 ${task.status === 'archived' ? 'bg-gray-50 opacity-75' : ''}`}>
                        <div className="flex items-start space-x-3">
                          {/* Bulk Selection Checkbox */}
                          {bulkMode && (
                            <Checkbox
                              checked={selectedTasks.includes(task.id)}
                              onCheckedChange={(checked) => handleTaskSelect(task.id, checked as boolean)}
                              className="mt-1"
                            />
                          )}

                          {/* Task Content */}
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-medium flex items-center">
                                  {task.title}
                                  {task.status === 'archived' && (
                                    <span className="ml-2 text-xs text-gray-500">(Archived)</span>
                                  )}
                                </h3>
                                {task.description && (
                                  <p className="text-sm text-gray-600">{task.description}</p>
                                )}
                                {task.due_date && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Due: {new Date(task.due_date).toLocaleDateString()}
                                    {new Date(task.due_date) < new Date() && task.status !== 'approved' && task.status !== 'archived' && (
                                      <span className="text-red-500 ml-1">• Overdue</span>
                                    )}
                                  </p>
                                )}
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                                {task.status.replace('_', ' ')}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <div className="text-sm text-gray-600">
                                Assigned to: <span className="font-medium">{task.assigned_user?.name}</span> • 
                                <span className="font-bold text-blue-600"> {task.points} points</span>
                              </div>

                              {/* Action Buttons */}
                                {!bulkMode && task.status !== 'archived' && (
                                  <div className="flex items-center space-x-1">
                                    {task.status === 'completed' && (
                                      <Button size="sm" onClick={() => handleReviewTask(task)}>
                                        📋 Review
                                      </Button>
                                    )}
                                    
                                    {canEditTask(task) && (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => handleEditTask(task)}
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </Button>
                                    )}
                                    
                                    {canDeleteTask(task) && (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => handleDeleteTask(task)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    )}

                                    {canArchiveTask(task) && (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedTask(task)
                                          setIntendedAction('archive') // Set intent for single archive
                                          setShowDeleteModal(true)
                                        }}
                                        className="text-orange-600 hover:text-orange-700"
                                      >
                                        <Archive className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
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
    </>
  )
}
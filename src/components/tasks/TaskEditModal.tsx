'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Edit3, AlertTriangle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { CreateTaskData, Task } from '@/types'
import toast from 'react-hot-toast'

interface Child {
  id: string
  name: string
  points: number
}

interface TaskEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (taskData: Partial<CreateTaskData>) => Promise<void>
  task: Task | null
  children: Child[]
  saving?: boolean
}

export default function TaskEditModal({
  isOpen,
  onClose,
  onSave,
  task,
  children,
  saving = false
}: TaskEditModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    points: 5,
    assigned_to: '',
    due_date: '',
    deadline_time: '23:59',
    penalty_points: 0,
    task_type: 'non_negotiable' as 'negotiable' | 'non_negotiable',
    // Recurring task fields
    recurring_time: '23:59',
    recurring_day_of_week: 1,
    recurring_day_of_month: 1,
    is_recurring_enabled: true
  })

  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form data when task changes
  useEffect(() => {
    if (task) {
      // Extract the actual time from task data with better logic
      let actualTime = '23:59'
      
      // Priority order: recurring_time > time from due_date > deadline_time > default
      if (task.recurring_time) {
        // Recurring tasks should have recurring_time field
        actualTime = task.recurring_time
      } else if (task.due_date) {
        // Extract time from due_date for both recurring and one-time tasks
        if (task.due_date.includes('T')) {
          // ISO format: "2024-01-01T21:20:00" or with timezone
          try {
            // Parse the date and format it in local timezone
            const dateObj = new Date(task.due_date)
            if (!isNaN(dateObj.getTime())) {
              const hours = dateObj.getHours().toString().padStart(2, '0')
              const minutes = dateObj.getMinutes().toString().padStart(2, '0')
              actualTime = `${hours}:${minutes}`
            }
          } catch (e) {
            console.warn('Failed to parse task due_date:', task.due_date, e)
          }
        } else if (task.due_date.includes(' ')) {
          // Format: "2024-01-01 21:20:00"
          const timePart = task.due_date.split(' ')[1]
          if (timePart && timePart.includes(':')) {
            actualTime = timePart.substring(0, 5) // Get HH:MM
          }
        }
      } else if (task.deadline_time) {
        // One-time tasks might use deadline_time
        actualTime = task.deadline_time
      }
      
      console.log('TaskEditModal: Extracted time', { 
        taskId: task.id, 
        isRecurring: task.is_recurring,
        recurringTime: task.recurring_time,
        dueDate: task.due_date,
        deadlineTime: task.deadline_time,
        extractedTime: actualTime 
      })

      setFormData({
        title: task.title,
        description: task.description || '',
        points: task.points,
        assigned_to: task.assigned_to,
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        deadline_time: task.deadline_time || actualTime,
        penalty_points: task.penalty_points || 0,
        task_type: task.task_type || 'non_negotiable',
        // Recurring task fields
        recurring_time: actualTime,
        recurring_day_of_week: task.recurring_day_of_week || 1,
        recurring_day_of_month: task.recurring_day_of_month || 1,
        is_recurring_enabled: task.is_recurring_enabled !== false
      })
      setHasChanges(false)
    }
  }, [task])

  // Track changes
  useEffect(() => {
    if (task) {
      const changed = (
        formData.title !== task.title ||
        formData.description !== (task.description || '') ||
        formData.points !== task.points ||
        formData.assigned_to !== task.assigned_to ||
        formData.due_date !== (task.due_date ? task.due_date.split('T')[0] : '') ||
        formData.deadline_time !== (task.deadline_time || '23:59') ||
        formData.penalty_points !== (task.penalty_points || 0) ||
        formData.task_type !== (task.task_type || 'non_negotiable') ||
        // For recurring tasks, also track recurring field changes
        (isRecurringTask(task) && (
          formData.recurring_time !== (task.recurring_time || '23:59') ||
          formData.recurring_day_of_week !== (task.recurring_day_of_week || 1) ||
          formData.recurring_day_of_month !== (task.recurring_day_of_month || 1) ||
          formData.is_recurring_enabled !== (task.is_recurring_enabled !== false)
        ))
      )
      setHasChanges(changed)
    }
  }, [formData, task])

  // Helper function to check if task is recurring
  const isRecurringTask = (task: Task): boolean => {
    return (task.is_recurring && !task.parent_task_id) || (!task.is_recurring && !!task.parent_task_id)
  }

  if (!isOpen || !task) return null

  const isTaskActive = task.status === 'pending' || task.status === 'in_progress'
  const isOneTimeTask = !isRecurringTask(task)
  const isRecurring = isRecurringTask(task)
  const hasTaskBeenWorkedOn = task.status !== 'pending'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Client-side validation for deadline time (one-time tasks only)
    if (isOneTimeTask && formData.due_date && formData.deadline_time) {
      const [hours, minutes] = formData.deadline_time.split(':').map(Number)
      const dueDateTime = new Date(formData.due_date)
      dueDateTime.setHours(hours, minutes, 0, 0)
      
      const now = new Date()
      const minFutureTime = new Date(now.getTime() + 30 * 60 * 1000)
      
      if (dueDateTime <= minFutureTime) {
        toast.error('Task deadline must be at least 30 minutes in the future')
        return
      }
    }
    
    try {
      const updateData: Partial<CreateTaskData> = {}
      
      if (formData.title !== task.title) updateData.title = formData.title
      if (formData.description !== (task.description || '')) {
        updateData.description = formData.description || undefined
      }
      if (formData.points !== task.points) updateData.points = formData.points
      if (formData.assigned_to !== task.assigned_to) updateData.assigned_to = formData.assigned_to
      if (formData.penalty_points !== (task.penalty_points || 0)) updateData.penalty_points = formData.penalty_points
      if (formData.task_type !== (task.task_type || 'non_negotiable')) {
        updateData.task_type = formData.task_type
        updateData.transferable = formData.task_type === 'negotiable'
      }
      
      // Handle due date and deadline time for one-time tasks
      if (isOneTimeTask && formData.due_date !== (task.due_date ? task.due_date.split('T')[0] : '')) {
        updateData.due_date = formData.due_date || undefined
      }
      if (isOneTimeTask && formData.deadline_time !== (task.deadline_time || '23:59')) {
        updateData.deadline_time = formData.deadline_time || undefined
      }
      
      // Handle recurring task parameters
      if (isRecurring) {
        // Get the original time value using the same logic as initialization
        let originalTime = '23:59'
        if (task.recurring_time) {
          originalTime = task.recurring_time
        } else if (task.due_date) {
          if (task.due_date.includes('T')) {
            const dateObj = new Date(task.due_date)
            if (!isNaN(dateObj.getTime())) {
              originalTime = dateObj.toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
              })
            }
          } else if (task.due_date.includes(' ')) {
            const timePart = task.due_date.split(' ')[1]
            if (timePart && timePart.includes(':')) {
              originalTime = timePart.substring(0, 5)
            }
          }
        }
        
        if (formData.recurring_time !== originalTime) {
          updateData.recurring_time = formData.recurring_time
          console.log('TaskEditModal: Updating recurring_time', {
            from: originalTime,
            to: formData.recurring_time
          })
        }
        if (task.recurring_pattern === 'weekly' && formData.recurring_day_of_week !== (task.recurring_day_of_week || 1)) {
          updateData.recurring_day_of_week = formData.recurring_day_of_week
        }
        if (task.recurring_pattern === 'monthly' && formData.recurring_day_of_month !== (task.recurring_day_of_month || 1)) {
          updateData.recurring_day_of_month = formData.recurring_day_of_month
        }
        if (formData.is_recurring_enabled !== (task.is_recurring_enabled !== false)) {
          updateData.is_recurring_enabled = formData.is_recurring_enabled
        }
      }

      await onSave(updateData)
      onClose()
    } catch (error) {
      // Error handling done in parent
    }
  }

  const getAssignedChildName = () => {
    return children.find(c => c.id === task.assigned_to)?.name || 'Unknown'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <Card className="w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Edit3 className="w-5 h-5 mr-2" />
            Edit Task
          </CardTitle>
          <CardDescription>
            Modify task details for "{task.title}"
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Warning for completed tasks */}
            {!isTaskActive && (
              <div className="flex items-start space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-800">
                    Limited Editing
                  </p>
                  <p className="text-xs text-orange-700">
                    This task has been {task.status}. Only basic details can be changed.
                  </p>
                </div>
              </div>
            )}

            {/* Task Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Task Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
                disabled={saving}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                disabled={saving}
                rows={2}
                placeholder="Optional task description..."
              />
            </div>

            {/* Points and Penalty Points */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="points">Reward Points</Label>
                <Select 
                  value={formData.points.toString()} 
                  onValueChange={(value) => setFormData({...formData, points: parseInt(value)})}
                  disabled={saving}
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
                  disabled={saving}
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

            {/* Task Type */}
            <div className="space-y-2">
              <Label htmlFor="taskType">Task Type</Label>
              <Select 
                value={formData.task_type} 
                onValueChange={(value: 'negotiable' | 'non_negotiable') => 
                  setFormData({...formData, task_type: value})
                }
                disabled={saving || !isTaskActive}
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

            {/* Due Date and Deadline Time (for one-time tasks) */}
            {isOneTimeTask && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    disabled={saving}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="deadlineTime">Deadline Time</Label>
                  <Input
                    id="deadlineTime"
                    type="time"
                    value={formData.deadline_time}
                    onChange={(e) => setFormData({...formData, deadline_time: e.target.value})}
                    disabled={saving || !formData.due_date}
                    className={!formData.due_date ? "opacity-50 cursor-not-allowed" : ""}
                    onClick={() => {
                      if (!formData.due_date) {
                        toast.error('Please choose a due date first')
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Recurring Task Parameters */}
            {isRecurring && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="recurringTime">Deadline Time</Label>
                  <Input
                    id="recurringTime"
                    type="time"
                    value={formData.recurring_time}
                    onChange={(e) => setFormData({...formData, recurring_time: e.target.value})}
                    disabled={saving}
                  />
                </div>

                {/* Weekly Day Selection */}
                {task.recurring_pattern === 'weekly' && (
                  <div className="space-y-2">
                    <Label htmlFor="dayOfWeek">Recurring Task Day</Label>
                    <Select 
                      value={formData.recurring_day_of_week.toString()} 
                      onValueChange={(value) => setFormData({...formData, recurring_day_of_week: parseInt(value)})}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sunday</SelectItem>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                        <SelectItem value="6">Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Monthly Date Selection */}
                {task.recurring_pattern === 'monthly' && (
                  <div className="space-y-2">
                    <Label htmlFor="dayOfMonth">Recurring Task Date</Label>
                    <Select 
                      value={formData.recurring_day_of_month.toString()} 
                      onValueChange={(value) => setFormData({...formData, recurring_day_of_month: parseInt(value)})}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                          <SelectItem key={day} value={day.toString()}>
                            {day === 1 ? '1st' : day === 2 ? '2nd' : day === 3 ? '3rd' : `${day}th`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Enabled/Disabled Toggle for Recurring Templates */}
                {task.is_recurring && !task.parent_task_id && (
                  <div className="space-y-2">
                    <Label htmlFor="isRecurringEnabled">Recurring Task Status</Label>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg bg-blue-50">
                      <Switch
                        id="isRecurringEnabled"
                        checked={formData.is_recurring_enabled}
                        onCheckedChange={(checked) => setFormData({...formData, is_recurring_enabled: checked})}
                        disabled={saving}
                      />
                      <div className="flex flex-col">
                        <Label htmlFor="isRecurringEnabled" className="text-sm font-medium">
                          {formData.is_recurring_enabled ? '✅ Enabled' : '⏸️ Disabled'}
                        </Label>
                        <p className="text-xs text-gray-600">
                          {formData.is_recurring_enabled 
                            ? 'Task will automatically generate new instances'
                            : 'Task is paused and won\'t generate new instances'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Assigned Child */}
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned To</Label>
              <Select 
                value={formData.assigned_to} 
                onValueChange={(value) => setFormData({...formData, assigned_to: value})}
                disabled={saving || !isTaskActive}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name} ({child.points} points)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasTaskBeenWorkedOn && formData.assigned_to !== task.assigned_to && (
                <p className="text-xs text-orange-600">
                  ⚠️ Changing assignment will reset task progress
                </p>
              )}
            </div>

            {/* Current Status Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Current status:</strong> {task.status.replace('_', ' ')} • 
                <strong> Assigned to:</strong> {getAssignedChildName()}
              </p>
              {task.completed_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Completed: {new Date(task.completed_at).toLocaleString()}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 pt-4">
              <Button 
                type="submit" 
                disabled={saving || !hasChanges}
                className="flex-1"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}
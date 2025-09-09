'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CreateTaskData, User } from '@/types'
import { X, AlertTriangle } from 'lucide-react'
import { recurringTasksService } from '@/services/recurringTasksService'

interface RecurringTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (taskData: CreateTaskData) => Promise<void>
  children: User[]
  saving?: boolean
}

export default function RecurringTaskModal({
  isOpen,
  onClose,
  onSave,
  children,
  saving = false
}: RecurringTaskModalProps) {
  const [formData, setFormData] = useState<CreateTaskData & { 
    recurringTime: string
    taskType: 'negotiable' | 'non_negotiable'
    recurringDayOfWeek: number
    recurringDayOfMonth: number
    hangingExpiresDate: string
    hangingExpiresTime: string
  }>({
    title: '',
    description: '',
    points: 5,
    assigned_to: '',
    is_recurring: true,
    recurring_pattern: 'daily',
    recurring_time: '10:00',
    recurring_day_of_week: 1, // Monday by default
    recurring_day_of_month: 1, // 1st by default
    penalty_points: 5,
    task_type: 'non_negotiable',
    transferable: false,
    is_hanging: false,
    hanging_expires_at: null,
    recurringTime: '10:00',
    taskType: 'non_negotiable',
    recurringDayOfWeek: 1,
    recurringDayOfMonth: 1,
    hangingExpiresDate: '',
    hangingExpiresTime: '10:00',
    is_strict: false,
    is_recurring_enabled: true, // New recurring tasks are enabled by default
  })

  const [timeValidation, setTimeValidation] = useState<{
    isValid: boolean
    errorMessage: string
  }>({ isValid: true, errorMessage: '' })

  // Validate timing whenever relevant fields change
  useEffect(() => {
    if (formData.recurringTime && formData.recurring_pattern) {
      const validation = recurringTasksService.validateRecurringTaskTiming({
        recurring_pattern: formData.recurring_pattern,
        recurring_time: formData.recurringTime,
        recurring_day_of_week: formData.recurring_pattern === 'weekly' ? formData.recurringDayOfWeek : undefined,
        recurring_day_of_month: formData.recurring_pattern === 'monthly' ? formData.recurringDayOfMonth : undefined
      })
      
      setTimeValidation({
        isValid: validation.isValid,
        errorMessage: validation.errorMessage || ''
      })
    }
  }, [formData.recurringTime, formData.recurring_pattern, formData.recurringDayOfWeek, formData.recurringDayOfMonth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.assigned_to && formData.assigned_to !== 'hanging') return
    
    // Prevent submission if time validation fails
    if (!timeValidation.isValid) {
      return
    }

    // Calculate hanging expires at if hanging task
    let hangingExpiresAt: string | null = null
    if (formData.assigned_to === 'hanging') {
      if (!formData.hangingExpiresDate || !formData.hangingExpiresTime) {
        return // This shouldn't happen with validation, but just in case
      }
      const [hours, minutes] = formData.hangingExpiresTime.split(':').map(Number)
      const expiresDateTime = new Date(formData.hangingExpiresDate)
      expiresDateTime.setHours(hours, minutes, 0, 0)
      hangingExpiresAt = expiresDateTime.toISOString()
    }

    try {
      const taskData: CreateTaskData = {
        title: formData.title,
        description: formData.description,
        points: formData.points,
        assigned_to: formData.assigned_to === 'hanging' ? '' : formData.assigned_to, // Recurring hanging tasks need special handling
        is_recurring: true,
        recurring_pattern: formData.recurring_pattern,
        recurring_time: formData.recurringTime,
        recurring_day_of_week: formData.recurring_pattern === 'weekly' ? formData.recurringDayOfWeek : null,
        recurring_day_of_month: formData.recurring_pattern === 'monthly' ? formData.recurringDayOfMonth : null,
        penalty_points: formData.penalty_points || 0,
        task_type: formData.taskType,
        transferable: formData.taskType === 'negotiable',
        is_hanging: formData.assigned_to === 'hanging',
        hanging_expires_at: hangingExpiresAt,
        is_strict: formData.is_strict,
        is_recurring_enabled: formData.is_recurring_enabled,
      }

      await onSave(taskData)
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        points: 5,
        assigned_to: '',
        is_recurring: true,
        recurring_pattern: 'daily',
        recurring_time: '10:00',
        recurring_day_of_week: 1,
        recurring_day_of_month: 1,
        penalty_points: 5,
        task_type: 'non_negotiable',
        transferable: false,
        is_hanging: false,
        hanging_expires_at: null,
        recurringTime: '10:00',
        taskType: 'non_negotiable',
        recurringDayOfWeek: 1,
        recurringDayOfMonth: 1,
        hangingExpiresDate: '',
        hangingExpiresTime: '10:00',
        is_strict: false,
        is_recurring_enabled: true,
      })
      onClose()
    } catch (error) {
      // Error handling is done in the parent component
    }
  }

  const handleTaskTypeChange = (taskType: 'negotiable' | 'non_negotiable') => {
    setFormData({
      ...formData,
      taskType,
      task_type: taskType,
      transferable: taskType === 'negotiable'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" style={{paddingRight: 'calc(100vw - 100%)'}}>
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto" style={{width: '448px', maxWidth: 'calc(100vw - 32px)'}}>
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold">🔄 Create Recurring Task</h2>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              placeholder="Clean your room"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Put away clothes, make bed..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="points">Reward Points</Label>
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
                  <SelectItem value="15">15 points</SelectItem>
                  <SelectItem value="20">20 points</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="penaltyPoints">Penalty Points</Label>
              <Select 
                value={formData.penalty_points?.toString() || '0'} 
                onValueChange={(value) => setFormData({...formData, penalty_points: parseInt(value)})}
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
              <Label htmlFor="pattern">Repeats</Label>
              <Select 
                value={formData.recurring_pattern || 'daily'} 
                onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setFormData({...formData, recurring_pattern: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Deadline Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.recurringTime}
                onChange={(e) => setFormData({...formData, recurringTime: e.target.value})}
                disabled={saving}
                className={!timeValidation.isValid ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
              />
              {!timeValidation.isValid && (
                <div className="flex items-center space-x-2 text-red-600 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{timeValidation.errorMessage}</span>
                </div>
              )}
            </div>
          </div>

          {formData.recurring_pattern === 'weekly' && (
            <div className="space-y-2">
              <Label htmlFor="dayOfWeek">Recurring Task Day</Label>
              <Select 
                value={formData.recurringDayOfWeek.toString()} 
                onValueChange={(value) => setFormData({...formData, recurringDayOfWeek: parseInt(value), recurring_day_of_week: parseInt(value)})}
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

          {formData.recurring_pattern === 'monthly' && (
            <div className="space-y-2">
              <Label htmlFor="dayOfMonth">Recurring Task Date</Label>
              <Select 
                value={formData.recurringDayOfMonth.toString()} 
                onValueChange={(value) => setFormData({...formData, recurringDayOfMonth: parseInt(value), recurring_day_of_month: parseInt(value)})}
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

          <div className="space-y-2">
            <Label htmlFor="taskType">Task Type</Label>
            <Select 
              value={formData.taskType} 
              onValueChange={handleTaskTypeChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="non_negotiable">
                  🔒 Non-Negotiable (Must be done by assigned child)
                </SelectItem>
                <SelectItem value="negotiable">
                  🤝 Negotiable (Can be transferred between children)
                </SelectItem>
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
            >
              <SelectTrigger>
                <SelectValue placeholder="Select child or hanging" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hanging">📌 Hanging Task</SelectItem>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.assigned_to === 'hanging' && (
            <>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  📌 <strong>Hanging Task:</strong> This recurring task will be available for any child to pick up. 
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
                    onChange={(e) => setFormData({...formData, hangingExpiresDate: e.target.value})}
                    disabled={saving}
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
                    disabled={saving}
                  />
                </div>
              </div>
            </>
          )}

          {/* Forbid Submissions Checkbox */}
          <div className="flex items-center space-x-2 p-3 border rounded-lg">
            <Checkbox
              id="isStrictRecurring"
              checked={formData.is_strict}
              onCheckedChange={(checked) => setFormData({...formData, is_strict: checked as boolean})}
              disabled={saving}
            />
            <div className="flex flex-col">
              <Label htmlFor="isStrictRecurring" className="text-sm font-medium">
                🔒 Forbid submissions after deadline
              </Label>
              <p className="text-xs text-gray-600">
                All recurring tasks become locked once their deadlines pass
              </p>
            </div>
          </div>


          {formData.taskType === 'negotiable' && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">
                🤝 <strong>Negotiable Task:</strong> The assigned child can negotiate with siblings 
                to transfer this task and split the reward points.
              </p>
            </div>
          )}

          {(formData.penalty_points || 0) > 0 && (
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">
                ⚡ <strong>Penalty System:</strong> If this task is not completed by the deadline, 
                {formData.penalty_points} points will be deducted from the child's total.
              </p>
            </div>
          )}

          <div className="flex space-x-2 pt-4">
            <Button type="submit" disabled={saving || !timeValidation.isValid} className="flex-1">
              {saving ? 'Creating...' : 'Create Recurring Task'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>

          {children.length === 0 && formData.taskType !== 'hanging' && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-700">
                No children found. Add children first!
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
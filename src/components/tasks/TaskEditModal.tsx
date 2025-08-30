'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Edit3, AlertTriangle } from 'lucide-react'
import { CreateTaskData, Task } from '@/types'

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
    due_date: ''
  })

  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form data when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        points: task.points,
        assigned_to: task.assigned_to,
        due_date: task.due_date ? task.due_date.split('T')[0] : ''
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
        formData.due_date !== (task.due_date ? task.due_date.split('T')[0] : '')
      )
      setHasChanges(changed)
    }
  }, [formData, task])

  if (!isOpen || !task) return null

  const isTaskActive = task.status === 'pending' || task.status === 'in_progress'
  const hasTaskBeenWorkedOn = task.status !== 'pending'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const updateData: Partial<CreateTaskData> = {}
      
      if (formData.title !== task.title) updateData.title = formData.title
      if (formData.description !== (task.description || '')) {
        updateData.description = formData.description || undefined
      }
      if (formData.points !== task.points) updateData.points = formData.points
      if (formData.assigned_to !== task.assigned_to) updateData.assigned_to = formData.assigned_to
      if (formData.due_date !== (task.due_date ? task.due_date.split('T')[0] : '')) {
        updateData.due_date = formData.due_date || undefined
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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

            {/* Points */}
            <div className="space-y-2">
              <Label htmlFor="points">Points Reward</Label>
              <Select 
                value={formData.points.toString()} 
                onValueChange={(value) => setFormData({...formData, points: parseInt(value)})}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 point (Easy)</SelectItem>
                  <SelectItem value="3">3 points (Medium)</SelectItem>
                  <SelectItem value="5">5 points (Hard)</SelectItem>
                  <SelectItem value="10">10 points (Very Hard)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
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
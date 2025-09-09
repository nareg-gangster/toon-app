'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Task } from '@/types'
import { X, Calendar, CalendarDays, Edit3, Trash2 } from 'lucide-react'

interface RecurringTaskActionModalProps {
  isOpen: boolean
  onClose: () => void
  onSingleAction: () => void
  onAllUpcomingAction: () => void
  task: Task | null
  actionType: 'edit' | 'delete'
  processing?: boolean
}

export default function RecurringTaskActionModal({
  isOpen,
  onClose,
  onSingleAction,
  onAllUpcomingAction,
  task,
  actionType,
  processing = false
}: RecurringTaskActionModalProps) {
  if (!isOpen || !task) return null

  const isTemplate = task.is_recurring && !task.parent_task_id
  const isInstance = !task.is_recurring && task.parent_task_id

  const getPatternDisplay = () => {
    switch (task.recurring_pattern) {
      case 'daily': return '📆 Daily'
      case 'weekly': return '📅 Weekly'
      case 'monthly': return '🗓️ Monthly'
      default: return 'Recurring'
    }
  }

  const getActionIcon = () => {
    return actionType === 'edit' ? <Edit3 className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />
  }

  const getActionColor = () => {
    return actionType === 'edit' ? 'text-blue-600' : 'text-red-600'
  }

  const getActionTitle = () => {
    return actionType === 'edit' ? 'Edit Recurring Task' : 'Delete Recurring Task'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className={`flex items-center ${getActionColor()}`}>
              {getActionIcon()}
              <span className="ml-2">{getActionTitle()}</span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onClose} disabled={processing}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription>
            You're about to {actionType} a recurring task. Choose your action scope.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Task Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{task.title}</h3>
              <Badge variant="outline">{getPatternDisplay()}</Badge>
            </div>
            {task.description && (
              <p className="text-sm text-gray-600 mb-2">{task.description}</p>
            )}
            <div className="flex items-center text-xs text-gray-500 space-x-4">
              <span>⭐ {task.points} points</span>
              {task.penalty_points && task.penalty_points > 0 && (
                <span>⚡ -{task.penalty_points} penalty</span>
              )}
            </div>
          </div>

          {/* Action Options */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">
              What would you like to {actionType}?
            </div>

            {/* Option 1: This task only */}
            <Button
              onClick={onSingleAction}
              disabled={processing}
              variant="outline"
              className="w-full justify-start p-4 h-auto"
            >
              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 mt-1 text-orange-600 flex-shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <div className="font-medium">
                    This task only
                  </div>
                  <div className="text-xs text-gray-500 mt-1 break-words">
                    {isTemplate 
                      ? `${actionType === 'edit' ? 'Change only this task. Future tasks won\'t be changed.' : 'Delete only this task. Future tasks will no longer be generated.'}`
                      : `Only ${actionType} this specific task. Other instances remain unchanged.`
                    }
                  </div>
                </div>
              </div>
            </Button>

            {/* Option 2: All upcoming tasks */}
            <Button
              onClick={onAllUpcomingAction}
              disabled={processing}
              variant="outline"
              className="w-full justify-start p-4 h-auto"
            >
              <div className="flex items-start space-x-3">
                <CalendarDays className="w-5 h-5 mt-1 text-blue-600 flex-shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <div className="font-medium">
                    This task + all future tasks
                  </div>
                  <div className="text-xs text-gray-500 mt-1 break-words">
                    {isTemplate 
                      ? `${actionType === 'edit' ? 'Update this task AND all future tasks.' : 'Delete this task AND all future tasks.'}`
                      : `${actionType === 'edit' ? 'Apply changes to this and all other pending tasks from the same series.' : 'Delete this and all other pending tasks from the same series.'}`
                    }
                  </div>
                </div>
              </div>
            </Button>
          </div>

          {/* Warning for delete */}
          {actionType === 'delete' && (
            <div className="p-3 bg-red-50 rounded-lg border-l-4 border-red-400">
              <div className="flex items-start">
                <div className="text-sm text-red-700">
                  <div className="font-medium">⚠️ Delete Action</div>
                  <div className="mt-1">
                    Deleted tasks cannot be recovered. Completed and approved tasks will not be affected.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info for edit */}
          {actionType === 'edit' && (
            <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
              <div className="flex items-start">
                <div className="text-sm text-blue-700">
                  <div className="font-medium">ℹ️ Edit Behavior</div>
                  <div className="mt-1">
                    Only pending and in-progress tasks can be edited. Completed and approved tasks will not be changed.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cancel Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="ghost" onClick={onClose} disabled={processing}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
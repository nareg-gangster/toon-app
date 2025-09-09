'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar } from '@/components/ui/avatar'
import { Edit3, Trash2, Archive, MessageSquare, Clock, Lock, Play, Pause } from 'lucide-react'
import { Task, Negotiation } from '@/types'
import CountdownTimer, { shouldShowCountdown } from '@/components/ui/CountdownTimer'
import { isTaskStrictAndLocked } from '@/lib/utils'
import { formatTaskDateTime, isTaskOverdue } from '@/lib/dateUtils'

interface Child {
  id: string
  name: string
  points: number
}

interface TaskCardProps {
  task: Task & { 
    hasNegotiations?: boolean
    negotiations?: Negotiation[]
  }
  bulkMode?: boolean
  selectedTasks?: string[]
  onTaskSelect?: (taskId: string, checked: boolean) => void
  onReviewTask?: (task: Task) => void
  onNegotiationClick?: () => void
  onEditTask?: (task: Task) => void
  onDeleteTask?: (task: Task) => void
  onArchiveTask?: (task: Task) => void
  onToggleEnabled?: (task: Task, enabled: boolean) => void
  canEditTask?: (task: Task) => boolean
  canDeleteTask?: (task: Task) => boolean
  canArchiveTask?: (task: Task) => boolean
  getStatusColor?: (status: string) => string
  isLatestRecurringTask?: boolean
  templateRecurringEnabled?: boolean // For instances, this represents the template's is_recurring_enabled
}

export default function TaskCard({
  task,
  bulkMode = false,
  selectedTasks = [],
  onTaskSelect,
  onReviewTask,
  onNegotiationClick,
  onEditTask,
  onDeleteTask,
  onArchiveTask,
  onToggleEnabled,
  canEditTask,
  canDeleteTask,
  canArchiveTask,
  getStatusColor,
  isLatestRecurringTask = false,
  templateRecurringEnabled
}: TaskCardProps) {
  // Check if task is overdue and if it's strict and locked
  const isOverdue = isTaskOverdue(task)
  const isStrictLocked = isTaskStrictAndLocked(task)
  const isDisabledRecurring = task.is_recurring && 
                               task.parent_task_id === null && 
                               task.is_recurring_enabled === false
  const isEnabledRecurringTemplate = task.is_recurring && 
                                       task.parent_task_id === null && 
                                       (task.is_recurring_enabled === true || task.is_recurring_enabled === undefined)
  
  // New logic: Previous recurring instances should be treated as regular tasks
  const isRecurringInstance = !task.is_recurring && task.parent_task_id !== null
  const isPreviousRecurringInstance = isRecurringInstance && !isLatestRecurringTask
  
  // For recurring instances, determine if the template is disabled
  const isInstanceOfDisabledTemplate = isRecurringInstance && templateRecurringEnabled === false
  const isInstanceOfEnabledTemplate = isRecurringInstance && templateRecurringEnabled !== false
  
  // Debug logging for disabled state
  if (isInstanceOfDisabledTemplate) {
    console.log('🔍 TaskCard: Instance of disabled template detected', {
      taskId: task.id,
      title: task.title,
      templateRecurringEnabled,
      isRecurringInstance,
      isInstanceOfDisabledTemplate
    })
  }
  
  const shouldShowRecurringControls = isLatestRecurringTask || isEnabledRecurringTemplate || isDisabledRecurring

  return (
    <div className={`border rounded-lg overflow-hidden ${
      task.status === 'archived' ? 'bg-gray-50 opacity-75' : 'bg-white'
    } ${
      task.hasNegotiations 
        ? 'border-orange-300 bg-orange-50' 
        : isStrictLocked
          ? 'border-red-500 bg-red-100'
          : isOverdue 
            ? 'border-red-300 bg-red-50' 
            : 'border-gray-200'
    } shadow-sm hover:shadow-md transition-shadow ${
      isStrictLocked ? 'opacity-90' : ''
    }`}>
      
      {/* Content area - this gets grayed out when paused */}
      <div className={`${(isDisabledRecurring || isInstanceOfDisabledTemplate) ? 'opacity-60 grayscale' : ''}`}>
      
      {/* Header with title and status */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            {/* Bulk Selection Checkbox */}
            {bulkMode && (
              <Checkbox
                checked={selectedTasks.includes(task.id)}
                onCheckedChange={(checked) => onTaskSelect?.(task.id, checked as boolean)}
                className="mt-1 flex-shrink-0"
              />
            )}
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 break-words">
                {task.title}
                {task.status === 'archived' && (
                  <span className="ml-2 text-xs text-gray-500">(Archived)</span>
                )}
              </h3>
              
              {task.description && (
                <p className="text-sm text-gray-600 mt-1 break-words">{task.description}</p>
              )}
              
              {/* Disabled recurring task message */}
              {isDisabledRecurring && (
                <p className="text-sm text-gray-500 mt-2 italic">
                  This task is not enabled and won't automatically create new tasks.
                </p>
              )}
            </div>
          </div>
          
          <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${getStatusColor?.(task.status) || 'bg-gray-100 text-gray-800'}`}>
            {(() => {
              if (task.status === 'approved' && (isInstanceOfDisabledTemplate || isDisabledRecurring)) {
                console.log('🔍 TaskCard: Approved task with disabled template:', {
                  id: task.id,
                  title: task.title,
                  status: task.status,
                  isInstanceOfDisabledTemplate,
                  isDisabledRecurring,
                  templateRecurringEnabled
                })
              }
              return task.status.replace('_', ' ')
            })()}
          </span>
        </div>

        {/* Special notifications */}
        {task.hasNegotiations && (
          <div className="flex items-center p-2 bg-orange-100 rounded-lg mb-3">
            <MessageSquare className="w-4 h-4 text-orange-600 mr-2 flex-shrink-0" />
            <span className="text-sm text-orange-700 font-medium">Child has requested changes to this task</span>
          </div>
        )}
        
        {isStrictLocked && (
          <div className="flex items-center p-2 bg-red-100 border border-red-300 rounded-lg mb-3">
            <Lock className="w-4 h-4 text-red-700 mr-2 flex-shrink-0" />
            <span className="text-sm text-red-800 font-medium">Task locked - Deadline missed and penalty applied</span>
          </div>
        )}
      </div>

      {/* Body with details */}
      <div className={`px-4 pb-4 ${isDisabledRecurring ? 'opacity-50 grayscale' : ''}`}>
        {/* Due date and countdown */}
        {task.due_date && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="w-4 h-4 mr-1 flex-shrink-0" />
              <span>Due: {formatTaskDateTime(task.due_date)}</span>
              {isTaskOverdue(task.due_date, task.status) && (
                <span className="text-red-500 ml-2 font-medium">• Overdue</span>
              )}
            </div>
            
            {shouldShowCountdown(task.due_date) && (
              <div className="flex justify-end sm:justify-start">
                <CountdownTimer dueDate={task.due_date} compact />
              </div>
            )}
          </div>
        )}

        {/* Assignee and points */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center">
            <Avatar 
              src={task.assigned_user?.avatar_url} 
              alt={task.assigned_user?.name}
              size="sm"
              fallbackName={task.assigned_user?.name}
              className="mr-2 flex-shrink-0"
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="font-medium text-gray-900">{task.assigned_user?.name}</span>
              <span className="font-bold text-blue-600">{task.points} points</span>
            </div>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1 mt-3">
          {task.task_type === 'negotiable' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              🤝 Negotiable
            </span>
          )}
          {task.task_type === 'hanging' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
              📌 Hanging
            </span>
          )}
          {task.is_strict && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              isStrictLocked 
                ? 'bg-red-200 text-red-800' 
                : 'bg-red-50 text-red-700'
            }`}>
              🔒 {isStrictLocked ? 'Locked' : 'Strict'}
            </span>
          )}
          {task.is_recurring && task.parent_task_id === null && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              task.is_recurring_enabled === false 
                ? 'bg-gray-100 text-gray-500' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {task.is_recurring_enabled === false ? '⏸️' : '🔄'} {task.recurring_pattern === 'daily' ? 'Daily' : task.recurring_pattern === 'weekly' ? 'Weekly' : 'Monthly'}
              {task.is_recurring_enabled === false && ' (Disabled)'}
            </span>
          )}
          {task.is_recurring === false && task.parent_task_id !== null && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
              📅 From {task.recurring_pattern === 'daily' ? 'Daily' : task.recurring_pattern === 'weekly' ? 'Weekly' : 'Monthly'} Task
            </span>
          )}
          {(task.penalty_points || 0) > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              ⚡ -{task.penalty_points} penalty
            </span>
          )}
        </div>

        {/* Overdue penalty notification */}
        {isOverdue && (task.penalty_points || 0) > 0 && !isStrictLocked && (
          <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <div className="text-red-600 text-sm font-medium">
                ⚠️ Task Overdue
              </div>
            </div>
            <p className="text-red-700 text-xs mt-1">
              Penalty of {task.penalty_points} point{task.penalty_points !== 1 ? 's' : ''} may be applied for missing the deadline.
              {!task.is_strict && ' Task can still be completed.'}
            </p>
          </div>
        )}
        
        {/* Strict task locked notification */}
        {isStrictLocked && (task.penalty_points || 0) > 0 && (
          <div className="mt-3 p-3 bg-red-200 border border-red-400 rounded-lg">
            <div className="flex items-start space-x-2">
              <Lock className="w-4 h-4 text-red-700 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-red-800 text-sm font-medium">
                  Task Deadline Missed
                </div>
                <p className="text-red-700 text-xs mt-1">
                  Penalty of {task.penalty_points} point{task.penalty_points !== 1 ? 's' : ''} has been applied. 
                  This strict task is now locked and cannot be completed.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Action Buttons - OUTSIDE grayscale area */}
      {!bulkMode && task.status !== 'archived' && (
        <div className="px-4 pb-4 pt-2 flex justify-end">
          <div className="flex items-center space-x-1">
            {/* Negotiation button */}
            {task.hasNegotiations && (
              <Button 
                size="sm" 
                onClick={onNegotiationClick}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Request</span>
              </Button>
            )}
            
            {/* Button logic for recurring tasks (latest instances only) */}
            {shouldShowRecurringControls && isLatestRecurringTask && (() => {
              const isTaskPaused = isInstanceOfDisabledTemplate
              const taskStatus = task.status

              // When paused
              if (isTaskPaused) {
                if (taskStatus === 'pending') {
                  // Paused + pending: delete + play
                  return (
                    <>
                      {canDeleteTask?.(task) && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onDeleteTask?.(task)}
                          className="p-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          onToggleEnabled?.(task, true)
                        }}
                        className="p-2 text-green-600 hover:text-green-700"
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    </>
                  )
                } else if (taskStatus === 'in_progress') {
                  // Paused + in progress: play only
                  return (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        onToggleEnabled?.(task, true)
                      }}
                      className="p-2 text-green-600 hover:text-green-700"
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                  )
                } else if (taskStatus === 'completed') {
                  // Paused + completed: review + play
                  return (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          console.log('🔍 TaskCard: Review button clicked for task:', {
                            id: task.id,
                            title: task.title,
                            status: task.status,
                            isRecurring: task.is_recurring,
                            parentTaskId: task.parent_task_id,
                            approvedAt: task.approved_at
                          })
                          onReviewTask?.(task)
                        }} 
                        className="text-xs"
                      >
                        📋 Review
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          onToggleEnabled?.(task, true)
                        }}
                        className="p-2 text-green-600 hover:text-green-700"
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    </>
                  )
                } else if (taskStatus === 'approved') {
                  // Paused + approved: archive + play
                  return (
                    <>
                      {canArchiveTask?.(task) && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onArchiveTask?.(task)}
                          className="text-orange-600 hover:text-orange-700 p-2"
                        >
                          <Archive className="w-3 h-3" />
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          onToggleEnabled?.(task, true)
                        }}
                        className="p-2 text-green-600 hover:text-green-700"
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    </>
                  )
                }
              } else {
                // When not paused (active)
                if (taskStatus === 'pending' || taskStatus === 'in_progress') {
                  // Active + pending/in progress: edit + pause
                  return (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onEditTask?.(task)}
                        className="p-2"
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          onToggleEnabled?.(task, false)
                        }}
                        className="p-2 text-orange-600 hover:text-orange-700"
                      >
                        <Pause className="w-3 h-3" />
                      </Button>
                    </>
                  )
                } else if (taskStatus === 'completed') {
                  // Active + completed: review + pause
                  return (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          console.log('🔍 TaskCard: Review button clicked for task:', {
                            id: task.id,
                            title: task.title,
                            status: task.status,
                            isRecurring: task.is_recurring,
                            parentTaskId: task.parent_task_id,
                            approvedAt: task.approved_at
                          })
                          onReviewTask?.(task)
                        }} 
                        className="text-xs"
                      >
                        📋 Review
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          onToggleEnabled?.(task, false)
                        }}
                        className="p-2 text-orange-600 hover:text-orange-700"
                      >
                        <Pause className="w-3 h-3" />
                      </Button>
                    </>
                  )
                } else if (taskStatus === 'approved') {
                  // Active + approved: archive + pause
                  return (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onArchiveTask?.(task)}
                        className="text-orange-600 hover:text-orange-700 p-2"
                      >
                        <Archive className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          onToggleEnabled?.(task, false)
                        }}
                        className="p-2 text-orange-600 hover:text-orange-700"
                      >
                        <Pause className="w-3 h-3" />
                      </Button>
                    </>
                  )
                }
              }
              return null
            })()}

            {/* Button logic for recurring templates (pause/play only) */}
            {shouldShowRecurringControls && (isEnabledRecurringTemplate || isDisabledRecurring) && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  const currentEnabled = task.is_recurring_enabled
                  onToggleEnabled?.(task, !currentEnabled)
                }}
                className={`p-2 ${
                  isDisabledRecurring
                    ? "text-green-600 hover:text-green-700" 
                    : "text-orange-600 hover:text-orange-700"
                }`}
              >
                {isDisabledRecurring ? (
                  <Play className="w-3 h-3" />
                ) : (
                  <Pause className="w-3 h-3" />
                )}
              </Button>
            )}
            
            {/* Button logic for regular tasks and previous recurring instances */}
            {!shouldShowRecurringControls && (() => {
              // Regular tasks get normal buttons based on status
              return (
                <>
                  {task.status === 'completed' && (
                    <Button 
                      size="sm" 
                      onClick={() => {
                        console.log('🔍 TaskCard: Review button clicked for task:', {
                          id: task.id,
                          title: task.title,
                          status: task.status,
                          isRecurring: task.is_recurring,
                          parentTaskId: task.parent_task_id,
                          approvedAt: task.approved_at
                        })
                        onReviewTask?.(task)
                      }} 
                      className="text-xs"
                    >
                      📋 Review
                    </Button>
                  )}

                  {(task.status === 'pending' || task.status === 'in_progress') && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onEditTask?.(task)}
                      className="p-2"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                  )}

                  {canDeleteTask?.(task) && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onDeleteTask?.(task)}
                      className="text-red-600 hover:text-red-700 p-2"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}

                  {task.status === 'approved' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onArchiveTask?.(task)}
                      className="text-orange-600 hover:text-orange-700 p-2"
                    >
                      <Archive className="w-3 h-3" />
                    </Button>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
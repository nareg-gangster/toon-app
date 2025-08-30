'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Trash2, Archive, AlertTriangle, Info } from 'lucide-react'
import { Task } from '@/types'

interface TaskDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onDelete: () => Promise<void>
  onArchive: () => Promise<void>
  tasks: Task[]
  processing?: boolean
  preferredAction?: 'delete' | 'archive'
}

export default function TaskDeleteModal({
  isOpen,
  onClose,
  onDelete,
  onArchive,
  tasks,
  processing = false,
  preferredAction
}: TaskDeleteModalProps) {
  const [confirmUnderstood, setConfirmUnderstood] = useState(false)
  const [action, setAction] = useState<'delete' | 'archive'>('delete')

  // MOVE ALL CALCULATIONS TO THE TOP (before any returns)
  const isMultiple = tasks.length > 1
  
  // Categorize tasks more specifically
  const deletableTasks = tasks.filter(task => 
    task.status === 'pending'
  )
  const archivableTasks = tasks.filter(task => 
    task.status === 'approved' // ONLY approved tasks can be archived
  )
  const nonActionableTasks = tasks.filter(task =>
    task.status === 'completed' || task.status === 'rejected' || task.status === 'in_progress'
  )
  
  const hasOnlyDeletable = deletableTasks.length === tasks.length
  const hasOnlyArchivable = archivableTasks.length === tasks.length
  const hasOnlyNonActionable = nonActionableTasks.length === tasks.length
  const hasMixed = (deletableTasks.length + archivableTasks.length + nonActionableTasks.length) > tasks.length || 
                   (deletableTasks.length > 0 && archivableTasks.length > 0) ||
                   (deletableTasks.length > 0 && nonActionableTasks.length > 0) ||
                   (archivableTasks.length > 0 && nonActionableTasks.length > 0)

  // Determine available actions
  const canDelete = deletableTasks.length > 0
  const canArchive = archivableTasks.length > 0
  const hasNonActionable = nonActionableTasks.length > 0

  // MOVE useEffect TO THE TOP, BEFORE ANY CONDITIONAL RETURNS
  useEffect(() => {
    // If a preferred action is specified, use that first
    if (preferredAction) {
      if (preferredAction === 'archive' && canArchive) {
        setAction('archive')
      } else if (preferredAction === 'delete' && canDelete) {
        setAction('delete')
      } else {
        // Fallback to original logic if preferred action isn't available
        if (hasOnlyArchivable) {
          setAction('archive')
        } else if (hasOnlyDeletable) {
          setAction('delete')
        } else if (canArchive && !canDelete) {
          setAction('archive')
        } else {
          setAction('delete')
        }
      }
    } else {
      // Original logic when no preference is given
      if (hasOnlyArchivable) {
        setAction('archive')
      } else if (hasOnlyDeletable) {
        setAction('delete')
      } else if (canArchive && !canDelete) {
        setAction('archive')
      } else {
        setAction('delete')
      }
    }
  }, [hasOnlyArchivable, hasOnlyDeletable, canArchive, canDelete, preferredAction])

  // Reset confirmation when action changes
  useEffect(() => {
    setConfirmUnderstood(false)
  }, [action])

  // NOW we can have conditional returns
  if (!isOpen || tasks.length === 0) return null

  const handleConfirm = async () => {
    try {
      if (action === 'archive') {
        await onArchive()
      } else {
        await onDelete()
      }
      setConfirmUnderstood(false)
      onClose()
    } catch (error) {
      // Error handling done in parent
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-purple-100 text-purple-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // If only non-actionable tasks, show different UI
  if (hasOnlyNonActionable) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-700">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Cannot Process {isMultiple ? 'Tasks' : 'Task'}
            </CardTitle>
            <CardDescription>
              {isMultiple ? 'These tasks' : 'This task'} cannot be deleted or archived at this time.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            
            <div className="flex items-start space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <Info className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800">Action Required</p>
                <p className="text-xs text-orange-700">
                  Tasks that are completed (waiting for approval) or rejected cannot be archived or deleted. You need to approve or provide feedback first.
                </p>
              </div>
            </div>

            {/* Task List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <p className="text-sm font-medium text-gray-700">Tasks requiring action:</p>
              {tasks.map((task) => (
                <div key={task.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-gray-600">
                      {task.assigned_user?.name}
                      {task.status === 'completed' && ' • Waiting for your approval'}
                      {task.status === 'rejected' && ' • Rejected, awaiting retry'}
                    </p>
                  </div>
                  <Badge className={getStatusColor(task.status)}>
                    {task.status === 'completed' ? 'needs review' : task.status}
                  </Badge>
                </div>
              ))}
            </div>

            <Button onClick={onClose} className="w-full">
              Got it
            </Button>

          </CardContent>
        </Card>
      </div>
    )
  }

  // Normal delete/archive modal continues here...
  const getActionTitle = () => {
    if (hasOnlyArchivable) return 'Archive'
    if (hasOnlyDeletable) return 'Delete'
    return action === 'archive' ? 'Archive' : 'Delete'
  }

  const getActionIcon = () => {
    return action === 'archive' ? <Archive className="w-5 h-5 mr-2" /> : <Trash2 className="w-5 h-5 mr-2" />
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className={`flex items-center ${action === 'delete' ? 'text-red-700' : 'text-orange-700'}`}>
            {getActionIcon()}
            {getActionTitle()} {isMultiple ? `${action === 'archive' ? archivableTasks.length : deletableTasks.length} Tasks` : 'Task'}
          </CardTitle>
          <CardDescription>
            {action === 'archive' 
              ? `Archive ${isMultiple ? `${archivableTasks.length} approved tasks` : `"${archivableTasks[0]?.title}"`}? They'll be preserved in history.`
              : `Permanently delete ${isMultiple ? `${deletableTasks.length} active tasks` : `"${deletableTasks[0]?.title}"`}?`
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          
          {/* Action Selection for Mixed Tasks */}
          {hasMixed && (canDelete || canArchive) && (
            <div className="space-y-3">
              <div className="flex items-start space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Multiple Task Types</p>
                  <p className="text-xs text-blue-700">
                    Choose how to handle the actionable tasks:
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {canDelete && (
                  <Button
                    variant={action === 'delete' ? 'default' : 'outline'}
                    onClick={() => setAction('delete')}
                    className="text-sm"
                    disabled={processing}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete Active
                    <Badge variant="secondary" className="ml-1">
                      {deletableTasks.length}
                    </Badge>
                  </Button>
                )}
                {canArchive && (
                  <Button
                    variant={action === 'archive' ? 'default' : 'outline'}
                    onClick={() => setAction('archive')}
                    className="text-sm"
                    disabled={processing}
                  >
                    <Archive className="w-4 h-4 mr-1" />
                    Archive Approved
                    <Badge variant="secondary" className="ml-1">
                      {archivableTasks.length}
                    </Badge>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Warning for Delete Action */}
          {action === 'delete' && (
            <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Permanent Deletion
                </p>
                <p className="text-xs text-red-700">
                  {hasMixed 
                    ? `Only ${deletableTasks.length} active tasks will be deleted.`
                    : 'This action cannot be undone. All task data will be lost.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Info for Archive Action */}
          {action === 'archive' && (
            <div className="flex items-start space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Archive className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Archive Completed Tasks
                </p>
                <p className="text-xs text-green-700">
                  These approved tasks will be preserved in your family's history. Points remain awarded.
                </p>
              </div>
            </div>
          )}

          {/* Task List */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <p className="text-sm font-medium text-gray-700">
              {action === 'delete' 
                ? `Active tasks to be deleted (${deletableTasks.length}):`
                : `Approved tasks to be archived (${archivableTasks.length}):`
              }
            </p>
            
            {(action === 'delete' ? deletableTasks : archivableTasks).map((task) => (
              <div key={task.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-gray-600">
                    {task.assigned_user?.name} • {task.points} points
                  </p>
                </div>
                <Badge className={getStatusColor(task.status)}>
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}

            {/* Show non-actionable tasks */}
            {hasNonActionable && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium text-gray-600 mb-2">
                  Tasks requiring your attention first ({nonActionableTasks.length}):
                </p>
                {nonActionableTasks.map((task) => (
                  <div key={task.id} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-orange-600">
                        {task.status === 'completed' ? 'Needs your review' : 'Rejected, awaiting child action'}
                      </p>
                    </div>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status === 'completed' ? 'review needed' : task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consequences */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">This action will:</p>
            <ul className="text-xs text-gray-600 space-y-1">
              {action === 'archive' ? (
                <>
                  <li>• Move {archivableTasks.length === 1 ? 'this approved task' : `${archivableTasks.length} approved tasks`} to history</li>
                  <li>• Preserve all completion data and awarded points</li>
                  <li>• Hide from main task view (viewable with "Show Archived")</li>
                </>
              ) : (
                <>
                  <li>• Permanently delete {deletableTasks.length === 1 ? 'this active task' : `${deletableTasks.length} active tasks`}</li>
                  <li>• Remove all task data and progress</li>
                  <li>• Cannot be recovered</li>
                </>
              )}
            </ul>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="confirm"
              checked={confirmUnderstood}
              onCheckedChange={setConfirmUnderstood}
              disabled={processing}
            />
            <label
              htmlFor="confirm"
              className="text-sm text-gray-700 cursor-pointer"
            >
              I understand this action {action === 'delete' ? 'cannot be undone' : 'will archive the approved tasks'}
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4 border-t">
            <Button
              variant={action === 'delete' ? 'destructive' : 'default'}
              onClick={handleConfirm}
              disabled={!confirmUnderstood || processing}
              className="flex-1"
            >
              {processing 
                ? `${action === 'delete' ? 'Deleting' : 'Archiving'}...` 
                : `${getActionTitle()} ${action === 'delete' ? deletableTasks.length : archivableTasks.length} Task${(action === 'delete' ? deletableTasks.length : archivableTasks.length) !== 1 ? 's' : ''}`
              }
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={processing}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
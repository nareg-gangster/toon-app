'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/hooks/useTasks'
import TaskCompletionModal from '@/components/tasks/TaskCompletionModal'
import TaskFilters from '@/components/tasks/TaskFilters'
import HangingTasksCard from '@/components/tasks/HangingTasksCard'
import StartNegotiationModal from '@/components/negotiations/StartNegotiationModal'
import { Avatar } from '@/components/ui/avatar'
import { TaskCompletionData } from '@/types'
import { MessageSquare, AlertTriangle, Clock, Lock } from 'lucide-react'
import { overdueTasksService } from '@/services/overdueTasksService'
import { useRecurringTaskCheck } from '@/hooks/useRecurringTaskCheck'
import Link from 'next/link'
import CountdownTimer, { shouldShowCountdown } from '@/components/ui/CountdownTimer'
import { isTaskStrictAndLocked, canSubmitTask } from '@/lib/utils'

export default function ChildTasksPage() {
  const { user, requireAuth } = useAuth()
  const { 
    tasks, 
    loading, 
    filters,
    updateFilters,
    clearFilters,
    updateTaskStatus, 
    completeTaskWithDetails,
    getFilterStats,
    refetchTasks
  } = useTasks(undefined, user?.id)
  
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [submittingCompletion, setSubmittingCompletion] = useState(false)
  const [showNegotiationModal, setShowNegotiationModal] = useState(false)
  const [selectedNegotiationTask, setSelectedNegotiationTask] = useState<any>(null)

  useEffect(() => {
    requireAuth('child')
  }, [])

  // DISABLED: Children should not be generating recurring tasks!
  // Only parents should handle recurring task generation
  // This was causing duplicate tasks when children completed recurring tasks
  /*
  useRecurringTaskCheck({
    enabled: !!user,
    refetchTasks
  })
  */

  const handleCompleteTask = (task: any) => {
    setSelectedTask(task)
    setShowCompletionModal(true)
  }

  const handleStartNegotiation = (task: any) => {
    setSelectedNegotiationTask(task)
    setShowNegotiationModal(true)
  }

  const handleTaskCompletionSubmit = async (completionData: TaskCompletionData) => {
    if (!selectedTask || !user) return

    setSubmittingCompletion(true)
    try {
      await completeTaskWithDetails(selectedTask.id, user.id, completionData)
      setShowCompletionModal(false)
      setSelectedTask(null)
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setSubmittingCompletion(false)
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

  const getTaskActionButton = (task: any) => {
    // Check if task is strict and locked
    const isStrictLocked = isTaskStrictAndLocked(task)
    const canSubmit = canSubmitTask(task)
    
    // Get overdue status for this task
    const overdueStatus = overdueTasksService.getTaskOverdueStatus(task)
    
    // If strict task is locked, show locked message
    if (isStrictLocked) {
      return (
        <div className="text-center py-3 bg-red-100 border border-red-300 rounded-lg">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <Lock className="w-4 h-4 text-red-700" />
            <p className="text-sm text-red-800 font-medium">Task Locked</p>
          </div>
          <p className="text-xs text-red-700">
            Deadline missed. Penalty applied.
          </p>
        </div>
      )
    }
    
    switch (task.status) {
      case 'pending':
        if (task.task_type === 'negotiable') {
          return (
            <div className="space-y-2">
              <Button className="w-full" onClick={() => updateTaskStatus(task.id, 'in_progress')}>
                🚀 Start Task
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => handleStartNegotiation(task)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Start Negotiations
              </Button>
              {overdueStatus.statusMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <p className="text-xs text-red-700 font-medium">{overdueStatus.statusMessage}</p>
                  </div>
                </div>
              )}
            </div>
          )
        }
        return (
          <div className="space-y-2">
            <Button className="w-full" onClick={() => updateTaskStatus(task.id, 'in_progress')}>
              🚀 Start Task
            </Button>
            {overdueStatus.statusMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center space-x-1">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <p className="text-xs text-red-700 font-medium">{overdueStatus.statusMessage}</p>
                </div>
              </div>
            )}
          </div>
        )
      case 'in_progress':
        if (task.task_type === 'negotiable') {
          return (
            <div className="space-y-2">
              <Button className="w-full" onClick={() => handleCompleteTask(task)}>
                ✅ Mark Complete
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => handleStartNegotiation(task)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Start Negotiations
              </Button>
              {overdueStatus.statusMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <p className="text-xs text-red-700 font-medium">{overdueStatus.statusMessage}</p>
                  </div>
                </div>
              )}
            </div>
          )
        }
        return (
          <div className="space-y-2">
            <Button className="w-full" onClick={() => handleCompleteTask(task)}>
              ✅ Mark Complete
            </Button>
            {overdueStatus.statusMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center space-x-1">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <p className="text-xs text-red-700 font-medium">{overdueStatus.statusMessage}</p>
                </div>
              </div>
            )}
          </div>
        )
      case 'completed':
        return (
          <div className="text-center py-2">
            <p className="text-sm text-gray-600">⏳ Waiting for parent approval</p>
          </div>
        )
      case 'approved':
        return (
          <div className="text-center py-2 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700 font-medium">🎉 Approved! Points earned!</p>
          </div>
        )
      case 'rejected':
        const rejectedOverdueStatus = overdueTasksService.getTaskOverdueStatus(task)
        return (
          <div className="text-center py-2 bg-red-50 rounded-lg space-y-2">
            <p className="text-sm text-red-700">❌ Task rejected</p>
            {task.rejection_reason && (
              <p className="text-xs text-red-600 mt-1 px-2">"{task.rejection_reason}"</p>
            )}
            <Button size="sm" className="mt-2" onClick={() => updateTaskStatus(task.id, 'in_progress')}>
              Try Again
            </Button>
            {rejectedOverdueStatus.canResubmitWithoutPenalty && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 mt-2">
                <div className="flex items-center justify-center space-x-1">
                  <Clock className="w-4 h-4 text-green-600" />
                  <p className="text-xs text-green-700 font-medium">{rejectedOverdueStatus.statusMessage}</p>
                </div>
              </div>
            )}
            {rejectedOverdueStatus.statusMessage && !rejectedOverdueStatus.canResubmitWithoutPenalty && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                <div className="flex items-center justify-center space-x-1">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <p className="text-xs text-red-700 font-medium">{rejectedOverdueStatus.statusMessage}</p>
                </div>
              </div>
            )}
          </div>
        )
      case 'archived':
        return (
          <div className="text-center py-2 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">📁 Archived Task</p>
          </div>
        )
      default:
        return null
    }
  }

  const stats = getFilterStats()

  if (!user) return null

  return (
    <>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Mobile Header - Hidden since we now have GlobalHeader on mobile */}
        <div className="hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
            <p className="text-sm text-gray-600">Complete tasks to earn points!</p>
          </div>
          <Link href="/dashboard/child">
            <Button variant="outline">← Back</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Filters & Stats */}
          <div className="lg:col-span-1 space-y-6">

            {/* Available Tasks to Pick Up */}
            <HangingTasksCard
              familyId={user.family_id}
              userId={user.id}
              userRole="child"
              onTaskPickup={() => refetchTasks()}
            />
            
            {/* My Stats */}
            <Card>
              <CardHeader>
                <CardTitle>📊 My Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{user.points || 0}</div>
                    <div className="text-sm text-blue-700">Total Points</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-center p-2 bg-yellow-50 rounded">
                      <div className="font-bold text-yellow-700">{stats.pending}</div>
                      <div className="text-yellow-600">Pending</div>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <div className="font-bold text-blue-700">{stats.inProgress}</div>
                      <div className="text-blue-600">Active</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <div className="font-bold text-purple-700">{stats.completed}</div>
                      <div className="text-purple-600">Review</div>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="font-bold text-green-700">{stats.approved}</div>
                      <div className="text-green-600">Done</div>
                    </div>
                  </div>
                  
                  {stats.overdue > 0 && (
                    <div className="text-center p-2 bg-red-50 rounded">
                      <div className="font-bold text-red-700">{stats.overdue}</div>
                      <div className="text-red-600 text-xs">Overdue Tasks</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <TaskFilters
              filters={filters}
              onFiltersChange={updateFilters}
              onClearFilters={clearFilters}
              isParent={false}
              stats={stats}
            />

          </div>

          {/* Tasks Grid */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>🎯 My Tasks</CardTitle>
                <CardDescription>
                  {tasks.length} tasks shown
                  {filters.status === 'active' && ' (active only)'}
                  {filters.showArchived && ' (including archived)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading your tasks...</p>
                  </div>
                ) : tasks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {tasks.map((task) => {
                      const overdueStatus = overdueTasksService.getTaskOverdueStatus(task)
                      const isStrictLocked = isTaskStrictAndLocked(task)
                      const cardClasses = `transition-all hover:shadow-md ${
                        task.status === 'archived' 
                          ? 'bg-gray-50 opacity-75' 
                          : isStrictLocked
                            ? 'border-2 border-red-400 bg-red-100/50 opacity-90'
                            : overdueStatus.isOverdue 
                              ? 'border-2 border-red-200 bg-red-50/30' 
                              : ''
                      }`

                      return (
                        <Card key={task.id} className={cardClasses}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Avatar 
                                    src={task.assigned_user?.avatar_url} 
                                    alt={task.assigned_user?.name}
                                    size="sm"
                                    fallbackName={task.assigned_user?.name}
                                  />
                                  <CardTitle className="text-base leading-tight flex items-center space-x-2">
                                    <span>{task.title}</span>
                                    {overdueStatus.isOverdue && (
                                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                    )}
                                  </CardTitle>
                                </div>
                                {task.description && (
                                  <CardDescription className="text-sm ml-10">
                                    {task.description}
                                  </CardDescription>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                {overdueStatus.isOverdue && (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center space-x-1">
                                    <Clock className="w-3 h-3" />
                                    <span>Overdue</span>
                                  </span>
                                )}
                                <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${getStatusColor(task.status)}`}>
                                  {task.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          
                          {/* Task Metadata */}
                          <div className="space-y-1 text-xs text-gray-500">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-blue-600">⭐ {task.points} points</span>
                              {task.task_type === 'negotiable' && (
                                <span className="text-green-600 font-medium">🤝 Negotiable</span>
                              )}
                              {task.task_type === 'hanging' && (
                                <span className="text-orange-600 font-medium">📌 Grabbed Task</span>
                              )}
                              {task.is_recurring === false && task.parent_task_id !== null && (
                                <span className="text-blue-500 font-medium">
                                  📅 {task.recurring_pattern === 'daily' ? 'Daily' : task.recurring_pattern === 'weekly' ? 'Weekly' : 'Monthly'}
                                </span>
                              )}
                              {(task.penalty_points || 0) > 0 && (
                                <span className="text-red-600 font-medium">⚡ -{task.penalty_points} pts penalty</span>
                              )}
                              {task.is_strict && (
                                <span className={`font-medium ${
                                  isTaskStrictAndLocked(task) 
                                    ? 'text-red-800' 
                                    : 'text-red-600'
                                }`}>
                                  🔒 {isTaskStrictAndLocked(task) ? 'Locked' : 'Strict'}
                                </span>
                              )}
                            </div>
                            {task.due_date && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span>📅 Due: {new Date(task.due_date).toLocaleDateString()} at {new Date(task.due_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  {new Date(task.due_date) < new Date() && task.status !== 'approved' && task.status !== 'archived' && (
                                    <span className="text-red-500 ml-1 font-medium">• Overdue!</span>
                                  )}
                                </div>
                                {shouldShowCountdown(task.due_date) && (
                                  <div className="flex justify-end">
                                    <CountdownTimer dueDate={task.due_date} compact />
                                  </div>
                                )}
                              </div>
                            )}
                            {task.status === 'archived' && task.archived_at && (
                              <div className="flex items-center text-gray-400">
                                📁 Archived: {new Date(task.archived_at).toLocaleDateString()}
                              </div>
                            )}
                            {task.approved_at && (
                              <div className="flex items-center text-green-600">
                                ✅ Approved: {new Date(task.approved_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            {/* Points Display */}
                            <div className="flex justify-between items-center">
                              <span className="text-2xl font-bold text-blue-600">{task.points}</span>
                              <span className="text-sm text-gray-500">points</span>
                            </div>
                            
                            {/* Action Button */}
                            {getTaskActionButton(task)}
                          </div>
                        </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-6">🎯</div>
                    {filters.status === 'active' ? (
                      <>
                        <h3 className="text-xl font-medium text-gray-900 mb-2">All caught up!</h3>
                        <p className="text-gray-500 mb-4">No active tasks right now.</p>
                        <p className="text-sm text-gray-400">
                          Great job staying on top of your tasks! Check back later for more.
                        </p>
                      </>
                    ) : filters.showArchived ? (
                      <>
                        <h3 className="text-xl font-medium text-gray-900 mb-2">No archived tasks</h3>
                        <p className="text-gray-500 mb-4">You haven't completed any tasks yet.</p>
                        <p className="text-sm text-gray-400">
                          Complete some tasks to build your history!
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-xl font-medium text-gray-900 mb-2">No tasks match your filters</h3>
                        <p className="text-gray-500 mb-6">Try adjusting your filters to see more tasks.</p>
                        <Button onClick={clearFilters}>
                          Clear All Filters
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* Task Completion Modal */}
      <TaskCompletionModal
        isOpen={showCompletionModal}
        onClose={() => {
          setShowCompletionModal(false)
          setSelectedTask(null)
        }}
        onSubmit={handleTaskCompletionSubmit}
        taskTitle={selectedTask?.title || ''}
        taskPoints={selectedTask?.points || 0}
        submitting={submittingCompletion}
      />

      {/* Start Negotiation Modal */}
      {selectedNegotiationTask && (
        <StartNegotiationModal
          isOpen={showNegotiationModal}
          onClose={() => {
            setShowNegotiationModal(false)
            setSelectedNegotiationTask(null)
          }}
          task={selectedNegotiationTask}
          onSuccess={() => {
            refetchTasks()
          }}
        />
      )}
    </>
  )
}
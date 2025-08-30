'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/hooks/useTasks'
import PasswordChangeModal from '@/components/PasswordChangeModal'
import TaskCompletionModal from '@/components/tasks/TaskCompletionModal'
import TaskFilters from '@/components/tasks/TaskFilters'
import { supabase } from '@/lib/supabase'
import { TaskCompletionData } from '@/types'
import Link from 'next/link'

export default function ChildDashboard() {
  const { user, loading, requireAuth, refetchUser } = useAuth()
  const { 
    tasks, 
    loading: tasksLoading, 
    filters,
    updateFilters,
    clearFilters,
    updateTaskStatus, 
    completeTaskWithDetails,
    getFilterStats
  } = useTasks(undefined, user?.id)
  
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false)
  const [checkingPassword, setCheckingPassword] = useState(true)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [submittingCompletion, setSubmittingCompletion] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('🔐 Child dashboard: Auth loaded, checking requirements')
      const authResult = requireAuth('child')
      if (authResult && user) {
        checkPasswordStatus()
      }
    }
  }, [loading, user])

  const checkPasswordStatus = async () => {
    if (!user) return

    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('password_changed')
        .eq('id', user.id)
        .single()

      console.log('Password status:', userData)

      if (error) {
        console.error('Error checking password status:', error)
        setCheckingPassword(false)
        return
      }

      if (!userData.password_changed) {
        setNeedsPasswordChange(true)
      }

    } catch (error) {
      console.error('Error checking password status:', error)
    } finally {
      setCheckingPassword(false)
    }
  }

  const handlePasswordChangeComplete = async () => {
    setNeedsPasswordChange(false)
    await refetchUser()
  }

  const handleCompleteTask = (task: any) => {
    setSelectedTask(task)
    setShowCompletionModal(true)
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
    switch (task.status) {
      case 'pending':
        return (
          <Button className="w-full" onClick={() => updateTaskStatus(task.id, 'in_progress')}>
            🚀 Start Task
          </Button>
        )
      case 'in_progress':
        return (
          <Button className="w-full" onClick={() => handleCompleteTask(task)}>
            ✅ Mark Complete
          </Button>
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
        return (
          <div className="text-center py-2 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">❌ Task rejected</p>
            {task.rejection_reason && (
              <p className="text-xs text-red-600 mt-1 px-2">"{task.rejection_reason}"</p>
            )}
            <Button size="sm" className="mt-2" onClick={() => updateTaskStatus(task.id, 'in_progress')}>
              Try Again
            </Button>
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

  // Show loading while auth is being determined
  if (loading || checkingPassword) {
    return (
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Don't render anything if no user (requireAuth will handle redirect)
  if (!user) {
    return null
  }

  // Show password change modal if needed - blocks all access
  if (needsPasswordChange) {
    return (
      <PasswordChangeModal
        isOpen={true}
        onComplete={handlePasswordChangeComplete}
        userName={user.name}
        isFirstLogin={true}
      />
    )
  }

  // Normal dashboard
  return (
    <>
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 md:hidden">My Tasks</h1>
          <p className="text-gray-600 md:hidden">Hello, {user.name}!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Stats & Filters */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* My Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  ⭐ My Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Points:</span>
                    <span className="font-bold text-blue-600">{user.points || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active Tasks:</span>
                    <span className="font-bold text-orange-600">
                      {stats.pending + stats.inProgress}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Need Review:</span>
                    <span className="font-bold text-purple-600">
                      {stats.completed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Completed:</span>
                    <span className="font-bold text-green-600">
                      {stats.approved}
                    </span>
                  </div>
                  {stats.overdue > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-red-600">Overdue:</span>
                      <span className="font-bold text-red-600">
                        {stats.overdue}
                      </span>
                    </div>
                  )}
                  
                  {/* Add profile link */}
                  <div className="pt-3 border-t">
                    <Link href="/dashboard/child/profile">
                      <Button variant="outline" size="sm" className="w-full">
                        👤 View My Profile
                      </Button>
                    </Link>
                  </div>
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

          {/* Tasks */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>📝 My Tasks</CardTitle>
                <CardDescription>
                  {tasks.length} tasks shown
                  {filters.status === 'active' && ' (active tasks only)'}
                  {filters.showArchived && ' (including archived)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tasksLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Loading tasks...</p>
                  </div>
                ) : tasks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {tasks.map((task) => (
                      <Card key={task.id} className={`${task.status === 'archived' ? 'bg-gray-50 opacity-75' : ''}`}>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center justify-between">
                            <span>{task.title}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </CardTitle>
                          <CardDescription>
                            {task.description}
                            {task.due_date && (
                              <div className="text-xs mt-1 flex items-center">
                                📅 Due: {new Date(task.due_date).toLocaleDateString()}
                                {new Date(task.due_date) < new Date() && task.status !== 'approved' && task.status !== 'archived' && (
                                  <span className="text-red-500 ml-1 font-medium">• Overdue!</span>
                                )}
                              </div>
                            )}
                            {task.status === 'archived' && task.archived_at && (
                              <div className="text-xs mt-1 text-gray-500">
                                📁 Archived: {new Date(task.archived_at).toLocaleDateString()}
                              </div>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-2xl font-bold text-blue-600">{task.points}</span>
                              <span className="text-sm text-gray-500">points</span>
                            </div>
                            
                            {getTaskActionButton(task)}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📝</div>
                    {filters.status === 'active' ? (
                      <>
                        <p className="text-gray-500 text-lg">No active tasks right now!</p>
                        <p className="text-sm text-gray-400 mt-2">
                          Great job! Check back later for new tasks.
                        </p>
                      </>
                    ) : filters.showArchived ? (
                      <>
                        <p className="text-gray-500 text-lg">No archived tasks found</p>
                        <p className="text-sm text-gray-400 mt-2">
                          Complete some tasks to build your history!
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-500 text-lg">No tasks match your filters</p>
                        <p className="text-sm text-gray-400 mt-2">
                          Try adjusting your filters or ask your parents for new tasks!
                        </p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={clearFilters}
                        >
                          Clear Filters
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
    </>
  )
}
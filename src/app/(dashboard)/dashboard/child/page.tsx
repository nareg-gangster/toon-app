'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/hooks/useTasks'
import PasswordChangeModal from '@/components/PasswordChangeModal'
import TaskCompletionModal from '@/components/tasks/TaskCompletionModal'
import { supabase } from '@/lib/supabase'
import { TaskCompletionData } from '@/types'
import Link from 'next/link'
import StartNegotiationModal from '@/components/negotiations/StartNegotiationModal'
import CountdownTimer, { shouldShowCountdown } from '@/components/ui/CountdownTimer'
import { useFamilyMembers } from '@/hooks/useFamilyMembers'
import { Trophy, Clock, Star, Zap, Lock } from 'lucide-react'
import { isTaskOverdue, isTaskStrictAndLocked, canSubmitTask } from '@/lib/utils'

export default function ChildDashboard() {
  const { user, loading, requireAuth, refetchUser } = useAuth()
  const { 
    tasks, 
    loading: tasksLoading, 
    updateTaskStatus, 
    completeTaskWithDetails,
    getFilterStats
  } = useTasks(undefined, user?.id)
  const { familyMembers } = useFamilyMembers(user?.family_id)
  
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false)
  const [checkingPassword, setCheckingPassword] = useState(true)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [submittingCompletion, setSubmittingCompletion] = useState(false)
  const [showNegotiationModal, setShowNegotiationModal] = useState(false)
  const [selectedTaskForNegotiation, setSelectedTaskForNegotiation] = useState<any>(null)

  // Helper function to get today's tasks (excluding approved tasks)
  const getTodaysTasks = () => {
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    
    return tasks.filter(task => {
      if (!task.due_date) return false
      const dueDate = new Date(task.due_date)
      return dueDate >= todayStart && 
             dueDate < todayEnd && 
             task.status !== 'archived' && 
             task.status !== 'approved' // Don't show completed/approved tasks
    })
  }


  // Helper function to get leaderboard data
  const getLeaderboard = () => {
    const children = familyMembers.filter(member => member.role === 'child')
    return children
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 5) // Top 5
  }

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

  const handleStartNegotiation = (task: any) => {
    setSelectedTaskForNegotiation(task)
    setShowNegotiationModal(true)
  }

  const handleNegotiationModalClose = () => {
    setShowNegotiationModal(false)
    setSelectedTaskForNegotiation(null)
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
    
    const isNegotiable = task.task_type === 'negotiable' && ['pending', 'in_progress'].includes(task.status)
    
    switch (task.status) {
      case 'pending':
        return (
          <div className="space-y-2">
            <Button className="w-full" onClick={() => updateTaskStatus(task.id, 'in_progress')}>
              🚀 Start Task
            </Button>
            {isNegotiable && (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => handleStartNegotiation(task)}
              >
                🤝 Start Negotiation
              </Button>
            )}
          </div>
        )
      case 'in_progress':
        return (
          <div className="space-y-2">
            <Button className="w-full" onClick={() => handleCompleteTask(task)}>
              ✅ Mark Complete
            </Button>
            {isNegotiable && (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => handleStartNegotiation(task)}
              >
                🤝 Start Negotiation
              </Button>
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
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user.name}!</h1>
          <p className="text-gray-600">Here's what's happening today</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Today's Tasks */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  Today's Tasks
                </CardTitle>
                <CardDescription>
                  {getTodaysTasks().length} task{getTodaysTasks().length !== 1 ? 's' : ''} due today
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tasksLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Loading tasks...</p>
                  </div>
                ) : getTodaysTasks().length > 0 ? (
                  <div className="space-y-4">
                    {getTodaysTasks().map((task) => {
                      const overdue = isTaskOverdue(task)
                      const isStrictLocked = isTaskStrictAndLocked(task)
                      return (
                        <Card key={task.id} className={`${
                          task.status === 'archived' ? 'bg-gray-50 opacity-75' : 
                          isStrictLocked ? 'border-red-500 bg-red-100 opacity-90' :
                          overdue ? 'border-red-300 bg-red-50' : ''
                        }`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{task.title}</CardTitle>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                                {task.status.replace('_', ' ')}
                              </span>
                            </div>
                            {task.description && (
                              <CardDescription>{task.description}</CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {/* Due date and countdown */}
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center text-gray-600">
                                  <Clock className="w-4 h-4 mr-1" />
                                  <span>Due: {new Date(task.due_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  {overdue && (
                                    <span className="text-red-500 ml-2 font-medium">• Overdue</span>
                                  )}
                                </div>
                                {shouldShowCountdown(task.due_date) && (
                                  <CountdownTimer dueDate={task.due_date} compact />
                                )}
                              </div>

                              {/* Points and badges */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xl font-bold text-blue-600">{task.points}</span>
                                  <span className="text-sm text-gray-500">points</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {task.task_type === 'negotiable' && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                      🤝 Negotiable
                                    </span>
                                  )}
                                  {task.is_recurring === false && task.parent_task_id !== null && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                                      📅 {task.recurring_pattern === 'daily' ? 'Daily' : task.recurring_pattern === 'weekly' ? 'Weekly' : 'Monthly'}
                                    </span>
                                  )}
                                  {(task.penalty_points || 0) > 0 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                      ⚡ -{task.penalty_points} penalty
                                    </span>
                                  )}
                                  {task.is_strict && (
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      isTaskStrictAndLocked(task) 
                                        ? 'bg-red-200 text-red-800' 
                                        : 'bg-red-50 text-red-700'
                                    }`}>
                                      🔒 {isTaskStrictAndLocked(task) ? 'Locked' : 'Strict'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Action buttons */}
                              {getTaskActionButton(task)}

                              {/* Overdue penalty notification */}
                              {overdue && (task.penalty_points || 0) > 0 && !isStrictLocked && (
                                <div className="p-3 bg-red-100 border border-red-200 rounded-lg">
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
                                <div className="p-3 bg-red-200 border border-red-400 rounded-lg">
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
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎯</div>
                    <p className="text-gray-500 text-lg">No tasks due today!</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Enjoy your free time or check tomorrow's schedule.
                    </p>
                    <Link href="/dashboard/child/tasks">
                      <Button variant="outline" className="mt-4">
                        View All Tasks
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Right Column - Stats & Leaderboard */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* My Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Star className="w-5 h-5 mr-2 text-yellow-500" />
                  My Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Points:</span>
                    <span className="font-bold text-blue-600">{user.points || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Today's Tasks:</span>
                    <span className="font-bold text-orange-600">
                      {getTodaysTasks().length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Need Review:</span>
                    <span className="font-bold text-purple-600">
                      {stats.completed}
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
                </div>
              </CardContent>
            </Card>

            {/* Sibling Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                  Leaderboard
                </CardTitle>
                <CardDescription>
                  Family points ranking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getLeaderboard().map((member, index) => (
                    <div key={member.id} className={`flex items-center justify-between p-2 rounded-lg ${
                      member.id === user.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-400 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-orange-400 text-white' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <span className={`text-sm ${member.id === user.id ? 'font-semibold text-blue-900' : 'text-gray-700'}`}>
                          {member.id === user.id ? 'You' : member.name}
                        </span>
                      </div>
                      <span className={`font-bold ${member.id === user.id ? 'text-blue-600' : 'text-gray-600'}`}>
                        {member.points || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-purple-500" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/dashboard/child/tasks">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    📝 All Tasks
                  </Button>
                </Link>
                <Link href="/dashboard/child/rewards">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    🏆 Rewards
                  </Button>
                </Link>
                <Link href="/dashboard/child/profile">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    👤 My Profile
                  </Button>
                </Link>
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
      {selectedTaskForNegotiation && (
        <StartNegotiationModal
          isOpen={showNegotiationModal}
          onClose={handleNegotiationModalClose}
          task={selectedTaskForNegotiation}
        />
      )}
    </>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Task } from '@/types'
import { tasksService } from '@/services/tasksService'
import toast from 'react-hot-toast'
import { Clock, Star } from 'lucide-react'

interface HangingTasksCardProps {
  familyId: string
  userId: string
  userRole: 'parent' | 'child'
  onTaskPickup?: (task: Task) => void
}

export default function HangingTasksCard({ 
  familyId, 
  userId, 
  userRole, 
  onTaskPickup 
}: HangingTasksCardProps) {
  const [hangingTasks, setHangingTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [pickingUp, setPickingUp] = useState<string | null>(null)

  useEffect(() => {
    loadHangingTasks()
    // Refresh every 30 seconds
    const interval = setInterval(loadHangingTasks, 30000)
    return () => clearInterval(interval)
  }, [familyId])

  const loadHangingTasks = async () => {
    try {
      const tasks = await tasksService.getHangingTasks(familyId)
      setHangingTasks(tasks)
    } catch (error) {
      console.error('Error loading hanging tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePickupTask = async (task: Task) => {
    if (userRole !== 'child') return

    setPickingUp(task.id)
    try {
      const updatedTask = await tasksService.pickupHangingTask(task.id, userId)
      toast.success(`You picked up "${task.title}"! 🎯`)
      
      // Remove from hanging tasks list
      setHangingTasks(prev => prev.filter(t => t.id !== task.id))
      
      // Notify parent component
      onTaskPickup?.(updatedTask)
    } catch (error: any) {
      console.error('Error picking up task:', error)
      toast.error(error.message || 'Failed to pick up task')
    } finally {
      setPickingUp(null)
    }
  }

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return null
    const date = new Date(dueDate)
    const now = new Date()
    
    if (date.toDateString() === now.toDateString()) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📌 Available Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading available tasks...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          📌 Available Tasks
          <span className="text-sm font-normal text-gray-500">
            {hangingTasks.length} task{hangingTasks.length !== 1 ? 's' : ''} available
          </span>
        </CardTitle>
        <CardDescription>
          {userRole === 'child' 
            ? "Grab these tasks first-come, first-served!" 
            : "Tasks available for children to pick up"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hangingTasks.length > 0 ? (
          <div className="space-y-3">
            {hangingTasks.map((task) => (
              <div 
                key={task.id} 
                className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{task.title}</h4>
                    {task.description && (
                      <p className="text-xs text-gray-600 mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500" />
                        <span className="font-medium text-blue-600">{task.points} pts</span>
                      </div>
                      {task.due_date && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDueDate(task.due_date)}</span>
                        </div>
                      )}
                      {task.hanging_expires_at && (
                        <div className="flex items-center gap-1 text-orange-600">
                          ⏰ Expires {formatDueDate(task.hanging_expires_at)}
                        </div>
                      )}
                      {(task.penalty_points || 0) > 0 && (
                        <div className="text-red-500 font-medium">
                          ⚡ -{task.penalty_points} pts if late
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {userRole === 'child' && (
                    <Button
                      size="sm"
                      onClick={() => handlePickupTask(task)}
                      disabled={pickingUp === task.id}
                      className="ml-2"
                    >
                      {pickingUp === task.id ? 'Picking up...' : '🎯 Grab it!'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">No tasks available to pick up right now</p>
            <p className="text-xs text-gray-400 mt-1">Check back later!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
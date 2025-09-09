'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Task, User } from '@/types'
import { tasksService } from '@/services/tasksService'
import toast from 'react-hot-toast'
import { Clock, AlertTriangle, Calendar, Trash2, UserPlus, X } from 'lucide-react'

interface ExpiredHangingTasksCardProps {
  familyId: string
  children: User[]
  onTaskUpdate?: () => void
}

export default function ExpiredHangingTasksCard({ 
  familyId, 
  children,
  onTaskUpdate 
}: ExpiredHangingTasksCardProps) {
  const [expiredTasks, setExpiredTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [activeTab, setActiveTab] = useState('extend')
  const [extensionData, setExtensionData] = useState<{
    date: string
    time: string
  }>({
    date: '',
    time: '10:00'
  })
  const [selectedChild, setSelectedChild] = useState('')

  useEffect(() => {
    loadExpiredTasks()
  }, [familyId])

  const loadExpiredTasks = async () => {
    try {
      const tasks = await tasksService.getExpiredHangingTasks(familyId)
      setExpiredTasks(tasks)
    } catch (error) {
      console.error('Error loading expired hanging tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const openManageModal = (task: Task) => {
    setSelectedTask(task)
    setActiveTab('extend')
    // Set default extension to 7 days from now
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 7)
    setExtensionData({
      date: defaultDate.toISOString().split('T')[0],
      time: '10:00'
    })
    setSelectedChild('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedTask(null)
    setActiveTab('extend')
    setExtensionData({ date: '', time: '10:00' })
    setSelectedChild('')
  }

  const handleExtendTask = async () => {
    if (!selectedTask || !extensionData.date || !extensionData.time) {
      toast.error('Please set both date and time for extension')
      return
    }

    setProcessing(true)
    try {
      const [hours, minutes] = extensionData.time.split(':').map(Number)
      const expiresDateTime = new Date(extensionData.date)
      expiresDateTime.setHours(hours, minutes, 0, 0)

      await tasksService.extendHangingTask(selectedTask.id, expiresDateTime.toISOString())
      toast.success('Task expiration extended! ⏰')
      
      // Remove from expired list
      setExpiredTasks(prev => prev.filter(t => t.id !== selectedTask.id))
      closeModal()
      onTaskUpdate?.()
    } catch (error: any) {
      console.error('Error extending task:', error)
      toast.error(error.message || 'Failed to extend task')
    } finally {
      setProcessing(false)
    }
  }

  const handleAssignTask = async () => {
    if (!selectedTask || !selectedChild) {
      toast.error('Please select a child')
      return
    }

    setProcessing(true)
    try {
      await tasksService.assignHangingTask(selectedTask.id, selectedChild)
      toast.success('Task assigned successfully! 👤')
      
      // Remove from expired list
      setExpiredTasks(prev => prev.filter(t => t.id !== selectedTask.id))
      closeModal()
      onTaskUpdate?.()
    } catch (error: any) {
      console.error('Error assigning task:', error)
      toast.error(error.message || 'Failed to assign task')
    } finally {
      setProcessing(false)
    }
  }

  const handleDeleteTask = async () => {
    if (!selectedTask) return

    setProcessing(true)
    try {
      await tasksService.deleteTask(selectedTask.id)
      toast.success('Task deleted successfully! 🗑️')
      
      // Remove from expired list
      setExpiredTasks(prev => prev.filter(t => t.id !== selectedTask.id))
      closeModal()
      onTaskUpdate?.()
    } catch (error: any) {
      console.error('Error deleting task:', error)
      toast.error(error.message || 'Failed to delete task')
    } finally {
      setProcessing(false)
    }
  }

  const formatExpiredDate = (expiredDate: string) => {
    const date = new Date(expiredDate)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 24) {
      return `${diffHours} hours ago`
    } else {
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Expired Hanging Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading expired tasks...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (expiredTasks.length === 0) {
    return null // Don't show card if no expired tasks
  }

  return (
    <>
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="w-5 h-5" />
            Expired Hanging Tasks ({expiredTasks.length})
          </CardTitle>
          <CardDescription>
            These hanging tasks have expired and need your attention.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {expiredTasks.map((task) => (
              <div 
                key={task.id} 
                className="border border-orange-200 rounded-lg p-4 bg-orange-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-orange-900">{task.title}</h4>
                    {task.description && (
                      <p className="text-xs text-orange-700 mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="font-medium text-blue-600">{task.points} points</span>
                      <div className="flex items-center gap-1 text-red-600">
                        <Clock className="w-3 h-3" />
                        <span>Expired {formatExpiredDate(task.hanging_expires_at!)}</span>
                      </div>
                      <span className="text-orange-600 capitalize">
                        {task.task_type?.replace('_', '-')}
                      </span>
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openManageModal(task)}
                    className="ml-2"
                  >
                    Manage
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Management Modal */}
      {showModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" style={{paddingRight: 'calc(100vw - 100%)'}}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{width: '512px', maxWidth: 'calc(100vw - 32px)'}}>
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-semibold">Manage Expired Task</h2>
                <p className="text-sm text-gray-600 mt-1">for: {selectedTask.title}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div>
                    <h3 className="font-medium text-orange-900">{selectedTask.title}</h3>
                    <p className="text-sm text-orange-700 mt-1">
                      {selectedTask.points} points • Expired {formatExpiredDate(selectedTask.hanging_expires_at!)}
                    </p>
                  </div>
                  <div className="text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="extend" className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Extend</span>
                  </TabsTrigger>
                  <TabsTrigger value="assign" className="flex items-center space-x-2">
                    <UserPlus className="w-4 h-4" />
                    <span>Assign</span>
                  </TabsTrigger>
                  <TabsTrigger value="delete" className="flex items-center space-x-2">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="extend" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        <span>Extend Task Expiration</span>
                      </CardTitle>
                      <CardDescription>
                        Set a new expiration date and time for this hanging task
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="extensionDate">New Expiry Date</Label>
                          <Input
                            id="extensionDate"
                            type="date"
                            value={extensionData.date}
                            onChange={(e) => setExtensionData({...extensionData, date: e.target.value})}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="extensionTime">Time</Label>
                          <Input
                            id="extensionTime"
                            type="time"
                            value={extensionData.time}
                            onChange={(e) => setExtensionData({...extensionData, time: e.target.value})}
                          />
                        </div>
                      </div>
                      <Button 
                        onClick={handleExtendTask} 
                        disabled={processing || !extensionData.date || !extensionData.time}
                        className="w-full"
                      >
                        {processing ? 'Extending...' : '⏰ Extend Task'}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="assign" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <UserPlus className="w-5 h-5 text-green-500" />
                        <span>Assign to Child</span>
                      </CardTitle>
                      <CardDescription>
                        Convert this hanging task to a regular assigned task
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {children.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p>No children available</p>
                          <p className="text-sm text-gray-400 mt-1">Add children to your family first</p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>Select Child</Label>
                            <Select 
                              value={selectedChild} 
                              onValueChange={setSelectedChild}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a child" />
                              </SelectTrigger>
                              <SelectContent>
                                {children.map((child) => (
                                  <SelectItem key={child.id} value={child.id}>
                                    {child.name} ({child.points} points)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button 
                            onClick={handleAssignTask} 
                            disabled={processing || !selectedChild}
                            className="w-full"
                          >
                            {processing ? 'Assigning...' : '👤 Assign Task'}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="delete" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Trash2 className="w-5 h-5 text-red-500" />
                        <span>Delete Task</span>
                      </CardTitle>
                      <CardDescription>
                        Permanently remove this expired hanging task
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-sm text-red-700">
                          ⚠️ <strong>Warning:</strong> This action cannot be undone. The task will be permanently deleted.
                        </p>
                      </div>
                      <Button 
                        onClick={handleDeleteTask} 
                        disabled={processing}
                        variant="destructive"
                        className="w-full"
                      >
                        {processing ? 'Deleting...' : '🗑️ Delete Task Permanently'}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
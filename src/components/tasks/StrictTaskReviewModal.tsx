'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, X, AlertTriangle, Star, User, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

interface StrictTaskReviewModalProps {
  isOpen: boolean
  onClose: () => void
  onApprove: () => Promise<void>
  onRejectWithGrace: (hours: number, reason: string) => Promise<void>
  onRejectWithPenalty: (reason: string) => Promise<void>
  task: {
    id: string
    title: string
    description: string | null
    points: number
    assigned_user?: { name: string }
    completed_at: string | null
    due_date: string | null
    rejection_reason?: string | null
    task_completions?: Array<{
      id: string
      photo_url: string | null
      completion_notes: string | null
      submitted_at: string
    }>
  }
  processing?: boolean
}

export default function StrictTaskReviewModal({
  isOpen,
  onClose,
  onApprove,
  onRejectWithGrace,
  onRejectWithPenalty,
  task,
  processing = false
}: StrictTaskReviewModalProps) {
  const [activeTab, setActiveTab] = useState('approve')
  const [graceHours, setGraceHours] = useState(24)
  const [graceReason, setGraceReason] = useState('')
  const [penaltyReason, setPenaltyReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  // Get the latest completion (most recent submitted_at)
  const completion = task.task_completions && task.task_completions.length > 0 
    ? task.task_completions.reduce((latest, current) => 
        new Date(current.submitted_at) > new Date(latest.submitted_at) ? current : latest
      )
    : null

  const hasPhoto = completion?.photo_url
  const hasNotes = completion?.completion_notes
  const isResubmission = task.rejection_reason // Task was previously rejected

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      await onApprove()
      onClose()
      toast.success('Task approved and points awarded! 🎉')
    } catch (error) {
      // Error handling done in parent
    } finally {
      setSubmitting(false)
    }
  }

  const handleRejectWithGrace = async () => {
    if (!graceReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setSubmitting(true)
    try {
      await onRejectWithGrace(graceHours, graceReason.trim())
      onClose()
      setGraceReason('')
      toast.success(`Task rejected with ${graceHours}h grace period`)
    } catch (error) {
      // Error handling done in parent
    } finally {
      setSubmitting(false)
    }
  }

  const handleRejectWithPenalty = async () => {
    if (!penaltyReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setSubmitting(true)
    try {
      await onRejectWithPenalty(penaltyReason.trim())
      onClose()
      setPenaltyReason('')
      toast.success('Task rejected with penalty applied')
    } catch (error) {
      // Error handling done in parent
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setGraceReason('')
    setPenaltyReason('')
    setActiveTab('approve')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" style={{paddingRight: 'calc(100vw - 100%)'}}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{width: '512px', maxWidth: 'calc(100vw - 32px)'}}>
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-semibold">Review Strict Task</h2>
            <p className="text-sm text-gray-600 mt-1">Child completed on time, but deadline passed during review</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6">
          {/* Task Summary */}
          <div className="mb-6">
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div>
                <h3 className="font-medium text-orange-900">{task.title}</h3>
                <p className="text-sm text-orange-700 mt-1">by {task.assigned_user?.name}</p>
                <div className="flex items-center text-xs text-orange-600 space-x-4 mt-2">
                  {task.due_date && (
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Due: {new Date(task.due_date).toLocaleString()}
                    </span>
                  )}
                  {completion?.submitted_at && (
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Submitted: {new Date(completion.submitted_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-bold text-orange-900">{task.points}</span>
              </div>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="mb-6 flex items-start space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Strict Task - Deadline Passed During Review
              </p>
              <p className="text-xs text-amber-700 mt-1">
                This child submitted the task before the deadline, but the deadline passed while waiting for your review. 
                Choose how to handle this situation fairly.
              </p>
            </div>
          </div>

          {/* Task Completion Details */}
          <div className="mb-6 space-y-3">
            <h3 className="font-medium">Task Details</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="font-medium">{task.title}</p>
              {task.description && (
                <p className="text-gray-600 text-sm">{task.description}</p>
              )}
            </div>

            {/* Previous Rejection Reason */}
            {isResubmission && task.rejection_reason && (
              <div className="space-y-2">
                <h4 className="font-medium text-orange-700">Previous Rejection Reason</h4>
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="p-3">
                    <p className="text-orange-800 text-sm">"{task.rejection_reason}"</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Photo Evidence */}
            {hasPhoto ? (
              <div className="space-y-2">
                <h4 className="font-medium">
                  {isResubmission ? 'Updated Photo Evidence' : 'Photo Evidence'}
                </h4>
                <Card>
                  <CardContent className="p-3">
                    <img
                      src={completion.photo_url}
                      alt="Task completion photo"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </CardContent>
                </Card>
              </div>
            ) : isResubmission && (
              <div className="space-y-2">
                <h4 className="font-medium">Photo Evidence</h4>
                <Card className="border-dashed">
                  <CardContent className="p-3 text-center text-gray-500">
                    <p className="text-sm">No photo provided in resubmission</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Child's Notes */}
            {hasNotes ? (
              <div className="space-y-2">
                <h4 className="font-medium">
                  {isResubmission ? 'Updated Child\'s Notes' : 'Child\'s Notes'}
                </h4>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-gray-700 text-sm">{completion.completion_notes}</p>
                  </CardContent>
                </Card>
              </div>
            ) : isResubmission && (
              <div className="space-y-2">
                <h4 className="font-medium">Child's Notes</h4>
                <Card className="border-dashed">
                  <CardContent className="p-3 text-center text-gray-500">
                    <p className="text-sm">No notes provided in resubmission</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* No additional info */}
            {!hasPhoto && !hasNotes && !isResubmission && (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">No additional information provided</p>
                <p className="text-xs">Child marked task as complete without photo or notes</p>
              </div>
            )}
          </div>

          {/* Decision Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="approve" className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>Approve</span>
              </TabsTrigger>
              <TabsTrigger value="grace" className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Reject + Grace</span>
              </TabsTrigger>
              <TabsTrigger value="penalty" className="flex items-center space-x-2">
                <XCircle className="w-4 h-4" />
                <span>Reject + Penalty</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="approve" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>Approve & Award Points</span>
                  </CardTitle>
                  <CardDescription>
                    The child completed the task satisfactorily and submitted it on time
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Star className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-900">Award {task.points} Points</span>
                    </div>
                    <p className="text-sm text-green-700">
                      Child will receive full points and the task will be marked as approved. 
                      No penalty will be applied since they submitted on time.
                    </p>
                  </div>

                  <Button 
                    onClick={handleApprove} 
                    disabled={submitting || processing}
                    className="w-full"
                  >
                    {submitting ? 'Approving...' : `Approve & Award ${task.points} Points`}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="grace" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <span>Reject but Give Grace Period</span>
                  </CardTitle>
                  <CardDescription>
                    Task needs improvement, but child submitted on time so they get extra time
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-900">Fair Rejection with Extension</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      Task will be rejected for improvement, but deadline will be extended since child submitted on time. 
                      No penalty will be applied.
                    </p>
                  </div>

                  <div>
                    <Label>Grace Period (Hours)</Label>
                    <Select 
                      value={graceHours.toString()} 
                      onValueChange={(value) => setGraceHours(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6 hours</SelectItem>
                        <SelectItem value="12">12 hours</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                        <SelectItem value="72">72 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      New deadline will be {graceHours} hours from now
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="graceMessage">Rejection Reason <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="graceMessage"
                      placeholder="Explain what needs to be improved or redone..."
                      value={graceReason}
                      onChange={(e) => setGraceReason(e.target.value)}
                      disabled={submitting}
                      rows={3}
                    />
                  </div>

                  <Button 
                    onClick={handleRejectWithGrace} 
                    disabled={!graceReason.trim() || submitting || processing}
                    className="w-full"
                  >
                    {submitting ? 'Rejecting...' : `Reject with ${graceHours}h Grace Period`}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="penalty" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span>Reject with Penalty</span>
                  </CardTitle>
                  <CardDescription>
                    Task quality is unacceptable - apply penalty and lock task
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-900">Harsh Rejection</span>
                    </div>
                    <p className="text-sm text-red-700">
                      Task will be rejected and penalty applied. Child will not be able to resubmit. 
                      Use this only when the submission quality is truly unacceptable.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="penaltyMessage">Rejection Reason <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="penaltyMessage"
                      placeholder="Explain why this submission is unacceptable..."
                      value={penaltyReason}
                      onChange={(e) => setPenaltyReason(e.target.value)}
                      disabled={submitting}
                      rows={3}
                    />
                  </div>

                  <Button 
                    onClick={handleRejectWithPenalty} 
                    disabled={!penaltyReason.trim() || submitting || processing}
                    variant="destructive"
                    className="w-full"
                  >
                    {submitting ? 'Rejecting...' : 'Reject with Penalty'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
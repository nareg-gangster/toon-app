'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Calendar, User } from 'lucide-react'

interface TaskReviewModalProps {
  isOpen: boolean
  onClose: () => void
  onApprove: () => Promise<void>
  onReject: (reason: string) => Promise<void>
  task: {
    id: string
    title: string
    description: string | null
    points: number
    assigned_user?: { name: string }
    completed_at: string | null
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

export default function TaskReviewModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  task,
  processing = false
}: TaskReviewModalProps) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
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
    } catch (error) {
      // Error handling done in parent
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      return // Rejection reason is required
    }

    setSubmitting(true)
    try {
      await onReject(rejectionReason.trim())
      onClose()
      setRejectionReason('')
      setShowRejectForm(false)
    } catch (error) {
      // Error handling done in parent
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              Review {isResubmission ? 'Resubmitted' : 'Completed'} Task
            </div>
            <Badge variant="secondary">
              {task.points} points
            </Badge>
          </CardTitle>
          <CardDescription>
            "{task.title}" completed by {task.assigned_user?.name}
            {isResubmission && (
              <span className="block text-orange-600 text-sm mt-1">
                ⚠️ This task was resubmitted after rejection
              </span>
            )}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          
          {/* Task Details */}
          <div className="space-y-3">
            <h3 className="font-medium">Task Details</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="font-medium">{task.title}</p>
              {task.description && (
                <p className="text-gray-600 text-sm">{task.description}</p>
              )}
              <div className="flex items-center text-xs text-gray-500 space-x-4">
                <span className="flex items-center">
                  <User className="w-3 h-3 mr-1" />
                  {task.assigned_user?.name}
                </span>
                {completion?.submitted_at && (
                  <span className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    Latest submission: {new Date(completion.submitted_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Previous Rejection Reason */}
          {isResubmission && task.rejection_reason && (
            <div className="space-y-3">
              <h3 className="font-medium text-orange-700">Previous Rejection Reason</h3>
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <p className="text-orange-800 text-sm">"{task.rejection_reason}"</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Photo Evidence */}
          {hasPhoto ? (
            <div className="space-y-3">
              <h3 className="font-medium">
                {isResubmission ? 'Updated Photo Evidence' : 'Photo Evidence'}
              </h3>
              <Card>
                <CardContent className="p-4">
                  <img
                    src={completion.photo_url}
                    alt="Task completion photo"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            isResubmission && (
              <div className="space-y-3">
                <h3 className="font-medium">Photo Evidence</h3>
                <Card className="border-dashed">
                  <CardContent className="p-4 text-center text-gray-500">
                    <p>No photo provided in resubmission</p>
                  </CardContent>
                </Card>
              </div>
            )
          )}

          {/* Child's Notes */}
          {hasNotes ? (
            <div className="space-y-3">
              <h3 className="font-medium">
                {isResubmission ? 'Updated Child\'s Notes' : 'Child\'s Notes'}
              </h3>
              <Card>
                <CardContent className="p-4">
                  <p className="text-gray-700">{completion.completion_notes}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            isResubmission && (
              <div className="space-y-3">
                <h3 className="font-medium">Child's Notes</h3>
                <Card className="border-dashed">
                  <CardContent className="p-4 text-center text-gray-500">
                    <p>No notes provided in resubmission</p>
                  </CardContent>
                </Card>
              </div>
            )
          )}

          {/* No additional info */}
          {!hasPhoto && !hasNotes && !isResubmission && (
            <div className="text-center py-6 text-gray-500">
              <p>No additional information provided</p>
              <p className="text-sm">Child marked task as complete without photo or notes</p>
            </div>
          )}

          {/* Rejection Form */}
          {showRejectForm && (
            <div className="space-y-3 border-t pt-4">
              <Label htmlFor="rejectionReason">
                Rejection Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejectionReason"
                placeholder="Explain why this task still isn't complete or needs to be redone..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={submitting}
                rows={3}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t">
            {!showRejectForm ? (
              <>
                <Button
                  onClick={handleApprove}
                  disabled={submitting || processing}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {submitting ? 'Approving...' : `Approve & Award ${task.points} Points`}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setShowRejectForm(true)}
                  disabled={submitting || processing}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject {isResubmission ? 'Again' : 'Task'}
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={onClose}
                  disabled={submitting || processing}
                >
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={!rejectionReason.trim() || submitting}
                  className="flex-1"
                >
                  {submitting ? 'Rejecting...' : 'Reject Task'}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectForm(false)
                    setRejectionReason('')
                  }}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
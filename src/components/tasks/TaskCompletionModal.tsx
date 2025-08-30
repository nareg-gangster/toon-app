'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle } from 'lucide-react'
import PhotoUpload from './PhotoUpload'

interface TaskCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { notes?: string; photo?: File }) => Promise<void>
  taskTitle: string
  taskPoints: number
  submitting?: boolean
}

export default function TaskCompletionModal({
  isOpen,
  onClose,
  onSubmit,
  taskTitle,
  taskPoints,
  submitting = false
}: TaskCompletionModalProps) {
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await onSubmit({
        notes: notes.trim() || undefined,
        photo: photo || undefined
      })
      
      // Reset form
      setNotes('')
      setPhoto(null)
      onClose()
    } catch (error) {
      // Error handling is done in parent component
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
            Mark Task Complete
          </CardTitle>
          <CardDescription>
            Great job on "{taskTitle}"! You'll earn {taskPoints} points once approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Show Your Work (Optional)</Label>
              <PhotoUpload
                onPhotoSelected={setPhoto}
                onPhotoRemoved={() => setPhoto(null)}
                currentPhoto={photo}
                disabled={submitting}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Add a Note (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Tell your parent about how you completed this task..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                rows={3}
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex space-x-2">
              <Button 
                type="submit" 
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? 'Submitting...' : 'Complete Task'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}
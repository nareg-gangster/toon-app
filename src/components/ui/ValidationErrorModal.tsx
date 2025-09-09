'use client'

import { Button } from '@/components/ui/button'
import { X, Clock, AlertTriangle } from 'lucide-react'

interface ValidationErrorModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message: string
  nextTaskTime?: Date
}

export default function ValidationErrorModal({
  isOpen,
  onClose,
  title = "Cannot Create Recurring Task",
  message,
  nextTaskTime
}: ValidationErrorModalProps) {
  if (!isOpen) return null

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-lg max-w-md w-full" style={{maxWidth: '448px'}}>
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-red-700">{title}</h2>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start space-x-3">
            <Clock className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-gray-700 leading-relaxed">
                {message}
              </p>
              
              {nextTaskTime && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    <strong>Next available task time:</strong><br />
                    {formatDateTime(nextTaskTime)}
                  </p>
                </div>
              )}
              
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700">
                  💡 <strong>Tip:</strong> Choose a time that's at least 30 minutes from now, 
                  or create the task for a different day/time.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t bg-gray-50">
          <Button onClick={onClose} className="min-w-24">
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}
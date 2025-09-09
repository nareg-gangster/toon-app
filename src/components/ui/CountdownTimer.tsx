'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface CountdownTimerProps {
  dueDate: string
  className?: string
  compact?: boolean
}

export default function CountdownTimer({ dueDate, className = '', compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number
    minutes: number
    seconds: number
    isOverdue: boolean
  }>({ hours: 0, minutes: 0, seconds: 0, isOverdue: false })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const due = new Date(dueDate).getTime()
      const difference = due - now

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((difference % (1000 * 60)) / 1000)
        
        setTimeLeft({ hours, minutes, seconds, isOverdue: false })
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isOverdue: true })
      }
    }

    // Calculate immediately
    calculateTimeLeft()

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [dueDate])

  // Only show countdown if less than 24 hours left and not overdue
  const totalHours = timeLeft.hours
  if (totalHours >= 24 || timeLeft.isOverdue) {
    return null
  }

  const formatTime = (num: number) => num.toString().padStart(2, '0')

  if (compact) {
    return (
      <div className={`inline-flex items-center text-xs font-medium ${
        totalHours <= 1 ? 'text-red-600 bg-red-50' : 
        totalHours <= 3 ? 'text-orange-600 bg-orange-50' : 
        'text-blue-600 bg-blue-50'
      } px-2 py-1 rounded-full ${className}`}>
        <Clock className="w-3 h-3 mr-1" />
        {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${
      totalHours <= 1 ? 'text-red-600' : 
      totalHours <= 3 ? 'text-orange-600' : 
      'text-blue-600'
    } ${className}`}>
      <Clock className="w-4 h-4" />
      <div className="flex items-center space-x-1">
        <span className="text-sm font-medium">
          {totalHours > 0 && `${formatTime(timeLeft.hours)}:`}
          {formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
        </span>
        <span className="text-xs opacity-75">left</span>
      </div>
    </div>
  )
}

// Helper function to check if a task should show countdown (< 24 hours and not overdue)
export function shouldShowCountdown(dueDate: string | null): boolean {
  if (!dueDate) return false
  
  const now = new Date().getTime()
  const due = new Date(dueDate).getTime()
  const difference = due - now
  
  // Show if less than 24 hours left and not overdue
  return difference > 0 && difference < (24 * 60 * 60 * 1000)
}
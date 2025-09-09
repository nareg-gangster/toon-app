import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Task } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isTaskOverdue(task: Task): boolean {
  return !!(task.due_date && 
         new Date(task.due_date) < new Date() && 
         task.status !== 'approved' && 
         task.status !== 'archived')
}

export function isTaskStrictAndLocked(task: Task): boolean {
  return !!(task.is_strict === true && 
         task.due_date &&
         new Date(task.due_date) < new Date() &&
         task.status !== 'approved' && 
         task.status !== 'archived' &&
         task.status !== 'completed')
}

export function canSubmitTask(task: Task): boolean {
  // If task is strict and overdue, it's locked and cannot be submitted
  if (isTaskStrictAndLocked(task)) {
    return false
  }
  
  // Otherwise, check normal submission rules
  return ['pending', 'in_progress', 'rejected'].includes(task.status)
}

export function shouldShowStrictTaskReviewModal(task: Task): boolean {
  return !!(task.is_strict === true && 
         task.status === 'completed' && 
         task.due_date &&
         new Date(task.due_date) < new Date())
}

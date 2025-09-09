// Utility functions for consistent date/time formatting across the app
// Fixes timezone display issues

/**
 * Format a date string as local time in Armenia timezone with 24-hour format
 */
export function formatTaskTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit', 
    hour12: false,
    timeZone: 'Asia/Yerevan'
  })
}

/**
 * Format a date string as local date
 */
export function formatTaskDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

/**
 * Format a date string as full date and time display
 */
export function formatTaskDateTime(dateString: string): string {
  return `${formatTaskDate(dateString)} at ${formatTaskTime(dateString)}`
}

/**
 * Check if a task is overdue
 */
export function isTaskOverdue(dateString: string, status: string): boolean {
  return new Date(dateString) < new Date() && 
         !['approved', 'archived'].includes(status)
}
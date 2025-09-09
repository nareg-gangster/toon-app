import { NextRequest, NextResponse } from 'next/server'
import { recurringTasksService } from '@/services/recurringTasksService'

// POST /api/recurring-tasks/generate
export async function POST(request: NextRequest) {
  try {
    // This endpoint should be called daily (e.g., by a cron job)
    // In production, you'd want to authenticate this endpoint or use a cron service
    
    await recurringTasksService.generateDailyTasks()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Daily tasks generated successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error generating daily tasks:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to generate daily tasks'
      },
      { status: 500 }
    )
  }
}
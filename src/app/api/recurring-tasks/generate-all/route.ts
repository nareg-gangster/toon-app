import { NextRequest, NextResponse } from 'next/server'
import { recurringTasksService } from '@/services/recurringTasksService'

// POST /api/recurring-tasks/generate-all
export async function POST(request: NextRequest) {
  try {
    // This endpoint should be called regularly to generate all types of recurring tasks
    // In production, you'd want to authenticate this endpoint or use a cron service
    
    const result = await recurringTasksService.generateAllRecurringTasks()
    
    return NextResponse.json({ 
      success: true, 
      message: 'All recurring tasks generated successfully',
      generated: result,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error generating recurring tasks:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to generate recurring tasks'
      },
      { status: 500 }
    )
  }
}
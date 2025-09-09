import { NextRequest, NextResponse } from 'next/server'
import { recurringTasksService } from '@/services/recurringTasksService'

// POST /api/recurring-tasks/penalties
export async function POST(request: NextRequest) {
  try {
    // This endpoint should be called regularly to process penalties for overdue tasks
    // In production, you'd want to authenticate this endpoint or use a cron service
    
    await recurringTasksService.processPenalties()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Penalties processed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error processing penalties:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to process penalties'
      },
      { status: 500 }
    )
  }
}
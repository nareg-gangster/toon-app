import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { recurringTasksService } from '@/services/recurringTasksService'

// POST /api/recurring-tasks/check-overdue
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Checking for overdue recurring tasks...')
    
    // First, test if we can connect to the database
    const { data: testData, error: testError } = await supabase
      .from('tasks')
      .select('id')
      .limit(1)
    
    if (testError) {
      console.error('❌ Database connection error:', testError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection failed: ' + testError.message 
        },
        { status: 500 }
      )
    }
    
    // Call the database function to check and generate overdue recurring tasks
    const { data, error } = await supabase.rpc('ensure_current_recurring_tasks')
    
    if (error) {
      console.error('❌ RPC Error:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Function error: ' + error.message,
          details: error
        },
        { status: 500 }
      )
    }
    
    console.log('✅ Overdue check result:', data)
    
    return NextResponse.json({ 
      success: true, 
      result: data,
      message: `Generated ${data?.generated || 0} overdue recurring tasks`,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('❌ Unexpected error in overdue check:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unexpected error occurred',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET /api/recurring-tasks/check-overdue (for testing)
export async function GET(request: NextRequest) {
  return POST(request)
}
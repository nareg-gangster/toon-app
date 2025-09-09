import { NextRequest, NextResponse } from 'next/server'
import { tasksService } from '@/services/tasksService'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/tasks/hanging?familyId=...
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')

    if (!familyId) {
      return NextResponse.json({ error: 'Family ID is required' }, { status: 400 })
    }

    const hangingTasks = await tasksService.getHangingTasks(familyId)
    
    return NextResponse.json({ 
      success: true, 
      data: hangingTasks 
    })
  } catch (error: any) {
    console.error('Error fetching hanging tasks:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch hanging tasks'
      },
      { status: 500 }
    )
  }
}
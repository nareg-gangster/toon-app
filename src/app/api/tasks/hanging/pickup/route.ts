import { NextRequest, NextResponse } from 'next/server'
import { tasksService } from '@/services/tasksService'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/tasks/hanging/pickup
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', session.user.id)
      .single()

    if (!user || user.role !== 'child') {
      return NextResponse.json({ error: 'Only children can pick up hanging tasks' }, { status: 403 })
    }

    const updatedTask = await tasksService.pickupHangingTask(taskId, user.id)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Task picked up successfully',
      data: updatedTask 
    })
  } catch (error: any) {
    console.error('Error picking up hanging task:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to pick up task'
      },
      { status: 500 }
    )
  }
}
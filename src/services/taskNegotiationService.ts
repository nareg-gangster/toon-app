import { supabase } from '@/lib/supabase'
import { TaskNegotiation, CreateNegotiationData, TaskTransfer, CreateTransferData, Task } from '@/types'

export const taskNegotiationService = {
  /**
   * Create a new task negotiation
   */
  async createNegotiation(negotiationData: CreateNegotiationData, fromChildId: string): Promise<TaskNegotiation> {
    // First, verify the task is negotiable
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('task_type, transferable, assigned_to')
      .eq('id', negotiationData.task_id)
      .single()

    if (taskError) throw taskError
    
    if (!task || task.task_type !== 'negotiable' || !task.transferable) {
      throw new Error('Task is not available for negotiation')
    }

    if (task.assigned_to !== fromChildId) {
      throw new Error('You can only negotiate tasks assigned to you')
    }

    // Check if negotiation already exists for this task
    const { data: existingNegotiation } = await supabase
      .from('task_negotiations')
      .select('id')
      .eq('task_id', negotiationData.task_id)
      .eq('status', 'pending')
      .single()

    if (existingNegotiation) {
      throw new Error('A negotiation for this task is already pending')
    }

    const { data: negotiation, error } = await supabase
      .from('task_negotiations')
      .insert({
        task_id: negotiationData.task_id,
        from_child_id: fromChildId,
        to_child_id: negotiationData.to_child_id,
        reward_split_from: negotiationData.reward_split_from,
        reward_split_to: negotiationData.reward_split_to,
        message: negotiationData.message || null,
        status: 'pending'
      })
      .select(`
        *,
        task:tasks(*),
        from_child:users!task_negotiations_from_child_id_fkey(id, name),
        to_child:users!task_negotiations_to_child_id_fkey(id, name)
      `)
      .single()

    if (error) throw error
    return negotiation
  },

  /**
   * Respond to a negotiation (accept/decline)
   */
  async respondToNegotiation(negotiationId: string, response: 'accepted' | 'declined', userId: string): Promise<TaskNegotiation> {
    // First get the negotiation to verify user can respond
    const { data: negotiation, error: fetchError } = await supabase
      .from('task_negotiations')
      .select('*')
      .eq('id', negotiationId)
      .eq('to_child_id', userId)
      .eq('status', 'pending')
      .single()

    if (fetchError) throw fetchError
    if (!negotiation) throw new Error('Negotiation not found or you cannot respond to it')

    // Update negotiation status
    const { data: updatedNegotiation, error: updateError } = await supabase
      .from('task_negotiations')
      .update({
        status: response,
        responded_at: new Date().toISOString()
      })
      .eq('id', negotiationId)
      .select(`
        *,
        task:tasks(*),
        from_child:users!task_negotiations_from_child_id_fkey(id, name),
        to_child:users!task_negotiations_to_child_id_fkey(id, name)
      `)
      .single()

    if (updateError) throw updateError

    // If accepted, transfer the task
    if (response === 'accepted') {
      await this.executeTaskTransfer({
        task_id: negotiation.task_id,
        to_child_id: negotiation.to_child_id,
        transfer_reason: 'Negotiation accepted'
      }, negotiation.from_child_id)

      // Update the task with split points (store original points in transfer history)
      const { error: taskUpdateError } = await supabase
        .from('tasks')
        .update({
          assigned_to: negotiation.to_child_id,
          original_assignee: negotiation.from_child_id,
          transfer_history: [{
            from: negotiation.from_child_id,
            to: negotiation.to_child_id,
            points_from: negotiation.reward_split_from,
            points_to: negotiation.reward_split_to,
            transferred_at: new Date().toISOString(),
            reason: 'Negotiation accepted'
          }]
        })
        .eq('id', negotiation.task_id)

      if (taskUpdateError) throw taskUpdateError
    }

    return updatedNegotiation
  },

  /**
   * Get negotiations for a user (sent or received)
   */
  async getNegotiationsForUser(userId: string): Promise<{
    sent: TaskNegotiation[]
    received: TaskNegotiation[]
  }> {
    const [sentResult, receivedResult] = await Promise.all([
      // Negotiations sent by user
      supabase
        .from('task_negotiations')
        .select(`
          *,
          task:tasks(*),
          to_child:users!task_negotiations_to_child_id_fkey(id, name)
        `)
        .eq('from_child_id', userId)
        .order('created_at', { ascending: false }),
      
      // Negotiations received by user
      supabase
        .from('task_negotiations')
        .select(`
          *,
          task:tasks(*),
          from_child:users!task_negotiations_from_child_id_fkey(id, name)
        `)
        .eq('to_child_id', userId)
        .order('created_at', { ascending: false })
    ])

    if (sentResult.error) throw sentResult.error
    if (receivedResult.error) throw receivedResult.error

    return {
      sent: sentResult.data || [],
      received: receivedResult.data || []
    }
  },

  /**
   * Execute a task transfer (used internally and for direct transfers)
   */
  async executeTaskTransfer(transferData: CreateTransferData, fromChildId?: string): Promise<TaskTransfer> {
    const { data: transfer, error } = await supabase
      .from('task_transfers')
      .insert({
        task_id: transferData.task_id,
        from_child_id: fromChildId || null,
        to_child_id: transferData.to_child_id,
        transfer_reason: transferData.transfer_reason || null
      })
      .select(`
        *,
        task:tasks(*),
        from_child:users!task_transfers_from_child_id_fkey(id, name),
        to_child:users!task_transfers_to_child_id_fkey(id, name)
      `)
      .single()

    if (error) throw error
    return transfer
  },

  /**
   * Get all available hanging tasks (unassigned tasks that can be picked up)
   */
  async getHangingTasks(familyId: string): Promise<Task[]> {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        *,
        created_by_user:users!tasks_created_by_fkey(name)
      `)
      .eq('family_id', familyId)
      .eq('task_type', 'hanging')
      .eq('is_available_for_pickup', true)
      .in('status', ['pending'])
      .order('created_at', { ascending: false })

    if (error) throw error
    return tasks || []
  },

  /**
   * Pick up a hanging task
   */
  async pickupHangingTask(taskId: string, childId: string): Promise<Task> {
    // First verify the task is available for pickup
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('task_type, is_available_for_pickup, status, assigned_to')
      .eq('id', taskId)
      .single()

    if (fetchError) throw fetchError
    
    if (!task || task.task_type !== 'hanging' || !task.is_available_for_pickup) {
      throw new Error('Task is not available for pickup')
    }

    if (task.status !== 'pending') {
      throw new Error('Task is no longer available')
    }

    // Assign the task to the child
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        assigned_to: childId,
        is_available_for_pickup: false,
        status: 'in_progress'
      })
      .eq('id', taskId)
      .select(`
        *,
        assigned_user:users!tasks_assigned_to_fkey(name, avatar_url)
      `)
      .single()

    if (updateError) throw updateError

    // Record the transfer
    await this.executeTaskTransfer({
      task_id: taskId,
      to_child_id: childId,
      transfer_reason: 'Picked up hanging task'
    })

    return updatedTask
  },

  /**
   * Get transfer history for a task
   */
  async getTaskTransfers(taskId: string): Promise<TaskTransfer[]> {
    const { data: transfers, error } = await supabase
      .from('task_transfers')
      .select(`
        *,
        from_child:users!task_transfers_from_child_id_fkey(id, name),
        to_child:users!task_transfers_to_child_id_fkey(id, name)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return transfers || []
  },

  /**
   * Cancel a pending negotiation
   */
  async cancelNegotiation(negotiationId: string, userId: string): Promise<void> {
    const { data: negotiation, error: fetchError } = await supabase
      .from('task_negotiations')
      .select('from_child_id')
      .eq('id', negotiationId)
      .eq('status', 'pending')
      .single()

    if (fetchError) throw fetchError
    if (!negotiation || negotiation.from_child_id !== userId) {
      throw new Error('Cannot cancel this negotiation')
    }

    const { error } = await supabase
      .from('task_negotiations')
      .delete()
      .eq('id', negotiationId)

    if (error) throw error
  }
}
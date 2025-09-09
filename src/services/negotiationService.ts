import { supabase } from '@/lib/supabase'
import { notificationTriggers } from '@/services/notificationTriggers'
import { 
  Negotiation, 
  NegotiationMessage, 
  CreateSiblingTransferData, 
  CreateParentNegotiationData,
  RespondToNegotiationData,
  NegotiationStats
} from '@/types'

export class NegotiationService {
  
  // Create a sibling transfer offer
  async createSiblingTransferOffer(data: CreateSiblingTransferData): Promise<Negotiation> {
    // Calculate expiration time
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + data.expires_in_hours)

    // Validate that points split correctly
    const { data: task } = await supabase
      .from('tasks')
      .select('points')
      .eq('id', data.task_id)
      .single()

    if (!task) {
      throw new Error('Task not found')
    }

    // Validate individual point values are not negative and don't exceed task total
    if (data.points_offered_to_recipient < 0 || data.points_kept_by_initiator < 0) {
      throw new Error('Point values cannot be negative')
    }

    if (data.points_offered_to_recipient > task.points || data.points_kept_by_initiator > task.points) {
      throw new Error('Individual point values cannot exceed total task points')
    }

    if (data.points_offered_to_recipient + data.points_kept_by_initiator !== task.points) {
      throw new Error('Point split must equal original task points')
    }

    // Create the negotiation
    const currentUserId = (await supabase.auth.getUser()).data.user!.id
    const { data: negotiation, error } = await supabase
      .from('negotiations')
      .insert({
        task_id: data.task_id,
        negotiation_type: 'sibling_transfer',
        initiator_id: currentUserId,
        recipient_id: data.recipient_id,
        points_offered_to_recipient: data.points_offered_to_recipient,
        points_kept_by_initiator: data.points_kept_by_initiator,
        expires_at: expiresAt.toISOString(),
        offer_message: data.offer_message || null
      })
      .select(`
        *,
        task:tasks(*),
        initiator:users!negotiations_initiator_id_fkey(*),
        recipient:users!negotiations_recipient_id_fkey(*)
      `)
      .single()

    if (error) throw error

    // Update task negotiation status
    await supabase
      .from('tasks')
      .update({ negotiation_status: 'being_negotiated' })
      .eq('id', data.task_id)

    // Create initial message
    await this.addNegotiationMessage(negotiation.id, 'offer', data.offer_message || 'Transfer offer')

    // Send notification to recipient about new negotiation offer
    try {
      const taskTitle = negotiation.task?.title || 'Task'
      await notificationTriggers.triggerNegotiationOffer(
        data.recipient_id,
        taskTitle,
        negotiation.id,
        data.task_id
      )
    } catch (notificationError) {
      console.error('Failed to send negotiation notification:', notificationError)
      // Don't throw error - negotiation creation should succeed even if notification fails
    }

    return negotiation as Negotiation
  }

  // Create a parent negotiation request
  async createParentNegotiationRequest(data: CreateParentNegotiationData): Promise<Negotiation> {
    const { data: negotiation, error } = await supabase
      .from('negotiations')
      .insert({
        task_id: data.task_id,
        negotiation_type: 'parent_negotiation',
        initiator_id: (await supabase.auth.getUser()).data.user!.id,
        recipient_id: data.recipient_id,
        requested_points: data.requested_points || null,
        requested_due_date: data.requested_due_date || null,
        requested_description: data.requested_description || null,
        offer_message: data.offer_message || null
      })
      .select(`
        *,
        task:tasks(*),
        initiator:users!negotiations_initiator_id_fkey(*),
        recipient:users!negotiations_recipient_id_fkey(*)
      `)
      .single()

    if (error) throw error

    // Update task negotiation status
    await supabase
      .from('tasks')
      .update({ negotiation_status: 'being_negotiated' })
      .eq('id', data.task_id)

    // Create initial message
    await this.addNegotiationMessage(negotiation.id, 'offer', data.offer_message || 'Negotiation request')

    return negotiation as Negotiation
  }

  // Respond to a negotiation
  async respondToNegotiation(negotiationId: string, response: RespondToNegotiationData): Promise<Negotiation> {
    const userId = (await supabase.auth.getUser()).data.user!.id

    if (response.response_type === 'accept') {
      return await this.acceptNegotiation(negotiationId, response.response_message)
    }

    if (response.response_type === 'reject') {
      return await this.rejectNegotiation(negotiationId, response.response_message)
    }

    if (response.response_type === 'counter_offer') {
      return await this.createCounterOffer(negotiationId, response)
    }

    throw new Error('Invalid response type')
  }

  // Accept a negotiation
  private async acceptNegotiation(negotiationId: string, responseMessage?: string): Promise<Negotiation> {
    // Get negotiation details
    const { data: negotiation } = await supabase
      .from('negotiations')
      .select('*')
      .eq('id', negotiationId)
      .single()

    if (!negotiation) throw new Error('Negotiation not found')

    // Get task details to check original assignee
    const { data: task } = await supabase
      .from('tasks')
      .select('assigned_to, original_assignee')
      .eq('id', negotiation.task_id)
      .single()

    if (!task) throw new Error('Task not found')

    // Update negotiation status
    const { data: updatedNegotiation, error } = await supabase
      .from('negotiations')
      .update({
        status: 'accepted',
        response_message: responseMessage || null,
        responded_at: new Date().toISOString()
      })
      .eq('id', negotiationId)
      .select(`
        *,
        task:tasks(*),
        initiator:users!negotiations_initiator_id_fkey(*),
        recipient:users!negotiations_recipient_id_fkey(*)
      `)
      .single()

    if (error) throw error

    // If sibling transfer, transfer task to Child B (the person A originally wanted to transfer to)
    if (negotiation.negotiation_type === 'sibling_transfer') {
      // Determine who was the original assignee before any negotiations started
      // If original_assignee is already set, keep it; otherwise use current assigned_to
      const originalAssignee = task.original_assignee || task.assigned_to
      
      // Find who should get the task: it should ALWAYS be Child B 
      // (the person who is NOT the original assignee)
      // This works regardless of counter-offers because the task should always go to the "other" person
      let finalAssignee: string
      
      if (negotiation.initiator_id === originalAssignee) {
        // If the person making current offer is the original assignee (Child A),
        // then task goes to the recipient (Child B)
        finalAssignee = negotiation.recipient_id
      } else {
        // If the person making current offer is NOT the original assignee (Child B in counter-offer),
        // then task still goes to Child B (the initiator in this case)
        finalAssignee = negotiation.initiator_id
      }
      
      // The task always goes to Child B (whoever is NOT the original assignee)
      // Determine correct point allocation based on who initiated this particular offer
      let pointsForFinalAssignee: number
      let pointsForOriginalAssignee: number
      
      if (negotiation.initiator_id === originalAssignee) {
        // Original offer: Child A initiated, so points_offered_to_recipient goes to Child B
        pointsForFinalAssignee = negotiation.points_offered_to_recipient
        pointsForOriginalAssignee = negotiation.points_kept_by_initiator
      } else {
        // Counter-offer: Child B initiated, so points_offered_to_recipient goes to Child A
        // and points_kept_by_initiator stays with Child B
        pointsForFinalAssignee = negotiation.points_kept_by_initiator
        pointsForOriginalAssignee = negotiation.points_offered_to_recipient
      }
      
      await supabase
        .from('tasks')
        .update({ 
          assigned_to: finalAssignee, // Always Child B
          negotiation_status: 'transferred',
          original_assignee: originalAssignee, // Always Child A
          // Set point split structure with corrected allocation
          point_split: {
            final_assignee: pointsForFinalAssignee,    // Points for Child B (who gets the task)
            original_assignee: pointsForOriginalAssignee // Points for Child A (original assignee)
          }
        })
        .eq('id', negotiation.task_id)
    }

    // If parent negotiation, update task with approved changes
    if (negotiation.negotiation_type === 'parent_negotiation') {
      const updates: any = { negotiation_status: 'none' }
      if (negotiation.requested_points) updates.points = negotiation.requested_points
      if (negotiation.requested_due_date) updates.due_date = negotiation.requested_due_date
      if (negotiation.requested_description) updates.description = negotiation.requested_description

      await supabase
        .from('tasks')
        .update(updates)
        .eq('id', negotiation.task_id)
    }

    // Add acceptance message
    await this.addNegotiationMessage(negotiationId, 'acceptance', responseMessage)

    // Send notification to the initiator about acceptance
    try {
      const taskTitle = updatedNegotiation.task?.title || 'Task'
      await notificationTriggers.triggerNegotiationResponse(
        updatedNegotiation.initiator_id,
        taskTitle,
        'accepted',
        negotiationId
      )
    } catch (notificationError) {
      console.error('Failed to send negotiation acceptance notification:', notificationError)
    }

    return updatedNegotiation as Negotiation
  }

  // Reject a negotiation
  private async rejectNegotiation(negotiationId: string, responseMessage?: string): Promise<Negotiation> {
    const { data: negotiation, error } = await supabase
      .from('negotiations')
      .update({
        status: 'rejected',
        response_message: responseMessage || null,
        responded_at: new Date().toISOString()
      })
      .eq('id', negotiationId)
      .select(`
        *,
        task:tasks(*),
        initiator:users!negotiations_initiator_id_fkey(*),
        recipient:users!negotiations_recipient_id_fkey(*)
      `)
      .single()

    if (error) throw error

    // Reset task negotiation status if no other pending negotiations
    await this.checkAndResetTaskNegotiationStatus(negotiation.task_id)

    // Add rejection message
    await this.addNegotiationMessage(negotiationId, 'rejection', responseMessage)

    // Send notification to the initiator about rejection
    try {
      const { data: taskData } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', negotiation.task_id)
        .single()
      
      const taskTitle = taskData?.title || 'Task'
      await notificationTriggers.triggerNegotiationResponse(
        negotiation.initiator_id,
        taskTitle,
        'rejected',
        negotiationId
      )
    } catch (notificationError) {
      console.error('Failed to send negotiation rejection notification:', notificationError)
    }

    return negotiation as Negotiation
  }

  // Create counter-offer
  private async createCounterOffer(negotiationId: string, response: RespondToNegotiationData): Promise<Negotiation> {
    // Get original negotiation and task details
    const { data: originalNegotiation } = await supabase
      .from('negotiations')
      .select('*')
      .eq('id', negotiationId)
      .single()

    if (!originalNegotiation) throw new Error('Negotiation not found')

    // Get the original task assignee to preserve across counter-offers
    const { data: task } = await supabase
      .from('tasks')
      .select('points, assigned_to')
      .eq('id', originalNegotiation.task_id)
      .single()

    if (!task) throw new Error('Task not found')

    // For sibling transfers, validate point split
    if (originalNegotiation.negotiation_type === 'sibling_transfer') {
      const offeredPoints = response.points_offered_to_recipient || 0
      const keptPoints = response.points_kept_by_initiator || 0

      // Validate individual point values are not negative and don't exceed task total
      if (offeredPoints < 0 || keptPoints < 0) {
        throw new Error('Point values cannot be negative')
      }

      if (offeredPoints > task.points || keptPoints > task.points) {
        throw new Error('Individual point values cannot exceed total task points')
      }

      const totalOffered = offeredPoints + keptPoints
      if (totalOffered !== task.points) {
        throw new Error('Point split must equal original task points')
      }
    }

    // Create new negotiation with swapped roles BUT preserve original task assignee info
    const counterOfferData: any = {
      task_id: originalNegotiation.task_id,
      negotiation_type: originalNegotiation.negotiation_type,
      initiator_id: originalNegotiation.recipient_id, // Current responder becomes initiator
      recipient_id: originalNegotiation.initiator_id, // Current initiator becomes recipient
      offer_message: response.response_message || null
    }

    // Add type-specific fields
    if (originalNegotiation.negotiation_type === 'sibling_transfer') {
      // For counter-offers, preserve the point allocation as the responder wants it
      // points_offered_to_recipient = what the counter-offer responder wants to give to the original initiator
      // points_kept_by_initiator = what the counter-offer responder wants to keep for themselves
      counterOfferData.points_offered_to_recipient = response.points_offered_to_recipient
      counterOfferData.points_kept_by_initiator = response.points_kept_by_initiator
      counterOfferData.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours default
    } else {
      counterOfferData.requested_points = response.requested_points
      counterOfferData.requested_due_date = response.requested_due_date
      counterOfferData.requested_description = response.requested_description
    }

    // Mark original as rejected
    await supabase
      .from('negotiations')
      .update({ status: 'rejected', responded_at: new Date().toISOString() })
      .eq('id', negotiationId)

    // Create counter-offer
    const { data: counterOffer, error } = await supabase
      .from('negotiations')
      .insert(counterOfferData)
      .select(`
        *,
        task:tasks(*),
        initiator:users!negotiations_initiator_id_fkey(*),
        recipient:users!negotiations_recipient_id_fkey(*)
      `)
      .single()

    if (error) throw error

    // Counter-offers do NOT transfer the task - task stays with original assignee
    // Task only transfers when someone accepts a negotiation

    // Add counter-offer message
    await this.addNegotiationMessage(counterOffer.id, 'counter_offer', response.response_message)

    return counterOffer as Negotiation
  }

  // Get negotiations for a user
  async getNegotiationsForUser(userId: string, type?: 'received' | 'sent'): Promise<Negotiation[]> {
    let query = supabase
      .from('negotiations')
      .select(`
        *,
        task:tasks(*),
        initiator:users!negotiations_initiator_id_fkey(*),
        recipient:users!negotiations_recipient_id_fkey(*)
      `)
      .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (type === 'received') {
      query = query.eq('recipient_id', userId)
    } else if (type === 'sent') {
      query = query.eq('initiator_id', userId)
    }

    const { data, error } = await query

    if (error) throw error

    return data as Negotiation[]
  }

  // Get negotiation statistics
  async getNegotiationStats(userId: string): Promise<NegotiationStats> {
    // Expire old negotiations first
    await supabase.rpc('expire_negotiations')

    const { data, error } = await supabase
      .from('negotiations')
      .select('recipient_id, initiator_id, status')
      .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
      .eq('status', 'pending')

    if (error) throw error

    const stats = {
      pending_received: data.filter(n => n.recipient_id === userId).length,
      pending_sent: data.filter(n => n.initiator_id === userId).length,
      total_active: data.length
    }

    return stats
  }

  // Get negotiation messages
  async getNegotiationMessages(negotiationId: string): Promise<NegotiationMessage[]> {
    const { data, error } = await supabase
      .from('negotiation_messages')
      .select(`
        *,
        sender:users(*)
      `)
      .eq('negotiation_id', negotiationId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return data as NegotiationMessage[]
  }

  // Add a message to negotiation
  private async addNegotiationMessage(
    negotiationId: string, 
    messageType: NegotiationMessage['message_type'], 
    message?: string
  ): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user!.id

    const { error } = await supabase
      .from('negotiation_messages')
      .insert({
        negotiation_id: negotiationId,
        sender_id: userId,
        message_type: messageType,
        message: message || null
      })

    if (error) throw error
  }

  // Withdraw a negotiation (initiator only)
  async withdrawNegotiation(negotiationId: string): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user!.id

    const { data: negotiation, error } = await supabase
      .from('negotiations')
      .update({ status: 'withdrawn' })
      .eq('id', negotiationId)
      .eq('initiator_id', userId)
      .select('task_id')
      .single()

    if (error) throw error

    // Check if task still has other pending negotiations
    await this.checkAndResetTaskNegotiationStatus(negotiation.task_id)

    // Add withdrawal message
    await this.addNegotiationMessage(negotiationId, 'withdrawal', 'Offer withdrawn')
  }

  // Helper: Check and reset task negotiation status if no pending negotiations
  private async checkAndResetTaskNegotiationStatus(taskId: string): Promise<void> {
    const { data: pendingNegotiations } = await supabase
      .from('negotiations')
      .select('id')
      .eq('task_id', taskId)
      .eq('status', 'pending')

    if (!pendingNegotiations || pendingNegotiations.length === 0) {
      await supabase
        .from('tasks')
        .update({ negotiation_status: 'none' })
        .eq('id', taskId)
    }
  }

  // Get siblings for transfer offers
  async getSiblingsForTransfer(taskId: string): Promise<{ id: string; name: string; points: number }[]> {
    const userId = (await supabase.auth.getUser()).data.user!.id
    
    // Get user's family_id
    const { data: user } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', userId)
      .single()

    if (!user) throw new Error('User not found')

    // Get all children in the family except current user
    const { data: siblings, error } = await supabase
      .from('users')
      .select('id, name, points')
      .eq('family_id', user.family_id)
      .eq('role', 'child')
      .neq('id', userId)

    if (error) throw error

    return siblings
  }

  // Get parents for negotiation requests
  async getParentsForNegotiation(): Promise<{ id: string; name: string }[]> {
    const userId = (await supabase.auth.getUser()).data.user!.id
    
    // Get user's family_id
    const { data: user } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', userId)
      .single()

    if (!user) throw new Error('User not found')

    // Get all parents in the family
    const { data: parents, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('family_id', user.family_id)
      .eq('role', 'parent')

    if (error) throw error

    return parents
  }

  // Check if task is negotiable
  async canNegotiateTask(taskId: string): Promise<boolean> {
    const { data: task } = await supabase
      .from('tasks')
      .select('task_type, status')
      .eq('id', taskId)
      .single()

    if (!task) return false

    return task.task_type === 'negotiable' && ['pending', 'in_progress'].includes(task.status)
  }
}

export const negotiationService = new NegotiationService()
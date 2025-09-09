export interface User {
  id: string
  name: string
  email: string
  role: 'parent' | 'child'
  family_id: string
  points: number
  avatar_url?: string
  created_at: string
}

export interface Family {
  id: string
  name: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  points: number
  status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected' | 'archived'
  due_date: string | null
  deadline_time: string | null
  assigned_to: string
  created_by: string
  family_id: string
  created_at: string
  completed_at: string | null
  approved_at: string | null
  archived_at: string | null
  rejection_reason: string | null
  // New fields for repeated tasks
  is_recurring?: boolean
  recurring_pattern?: 'daily' | 'weekly' | 'monthly' | null
  recurring_time?: string | null
  recurring_days?: string[] | null
  recurring_day_of_week?: number | null
  recurring_day_of_month?: number | null
  parent_task_id?: string | null
  recurring_rules?: any | null
  is_recurring_enabled?: boolean
  penalty_points?: number
  // New fields for task types and transfers
  task_type?: 'negotiable' | 'non_negotiable'
  transferable?: boolean
  original_assignee?: string | null
  transfer_history?: any[] | null
  is_available_for_pickup?: boolean
  // Hanging task fields
  is_hanging?: boolean
  hanging_expires_at?: string | null
  // Strict task field
  is_strict?: boolean
  // New negotiation fields
  negotiation_status?: 'none' | 'being_negotiated' | 'transferred'
  point_split?: { original_assignee: number; final_assignee: number } | null
  negotiation_history?: any[]
  assigned_user?: {
    name: string
  }
  task_completions?: TaskCompletion[]
  // Template enabled status for instances
  template_recurring_enabled?: boolean
  // Sequence number for recurring task ordering
  sequence_number?: number
}

export interface TaskFilters {
  status: string
  dueDate: string
  assignedTo: string
  showArchived: boolean
  taskType: 'all' | 'recurring' | 'one-time'
  recurringPattern: 'all' | 'daily' | 'weekly' | 'monthly'
}

export interface TaskCompletion {
  id: string
  task_id: string
  photo_url: string | null
  notes: string | null
  completion_notes: string | null
  submitted_at: string
}

export interface TaskCompletionData {
  notes?: string
  photo?: File
}

export interface CreateTaskData {
  title: string
  description?: string
  points: number
  assigned_to: string
  due_date?: string | null
  deadline_time?: string | null
  // New fields for repeated tasks
  is_recurring?: boolean
  recurring_pattern?: 'daily' | 'weekly' | 'monthly' | null
  recurring_time?: string | null
  recurring_days?: string[] | null
  recurring_day_of_week?: number | null
  recurring_day_of_month?: number | null
  is_recurring_enabled?: boolean
  penalty_points?: number
  // New fields for task types
  task_type?: 'negotiable' | 'non_negotiable'
  transferable?: boolean
  // Hanging task fields
  is_hanging?: boolean
  hanging_expires_at?: string | null
  // Strict task field
  is_strict?: boolean
}

// New comprehensive negotiation system interfaces
export interface Negotiation {
  id: string
  task_id: string
  negotiation_type: 'sibling_transfer' | 'parent_negotiation'
  initiator_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn'
  
  // For sibling transfers
  points_offered_to_recipient?: number | null
  points_kept_by_initiator?: number | null
  expires_at?: string | null
  
  // For parent negotiations
  requested_points?: number | null
  requested_due_date?: string | null
  requested_description?: string | null
  
  offer_message?: string | null
  response_message?: string | null
  created_at: string
  responded_at?: string | null
  
  // Joined data
  task?: Task
  initiator?: User
  recipient?: User
}

export interface NegotiationMessage {
  id: string
  negotiation_id: string
  sender_id: string
  message_type: 'offer' | 'counter_offer' | 'acceptance' | 'rejection' | 'withdrawal'
  
  // Offer details for counter-offers
  points_offered_to_recipient?: number | null
  points_kept_by_initiator?: number | null
  requested_points?: number | null
  requested_due_date?: string | null
  requested_description?: string | null
  
  message?: string | null
  created_at: string
  
  // Joined data
  sender?: User
}

// Create negotiation data interfaces
export interface CreateSiblingTransferData {
  task_id: string
  recipient_id: string
  points_offered_to_recipient: number
  points_kept_by_initiator: number
  offer_message?: string
  expires_in_hours: number // Will be converted to expires_at
}

export interface CreateParentNegotiationData {
  task_id: string
  recipient_id: string // parent_id
  requested_points?: number
  requested_due_date?: string
  requested_description?: string
  offer_message?: string
}

export interface RespondToNegotiationData {
  response_type: 'accept' | 'reject' | 'counter_offer'
  response_message?: string
  
  // For counter-offers
  points_offered_to_recipient?: number
  points_kept_by_initiator?: number
  requested_points?: number
  requested_due_date?: string
  requested_description?: string
}

// Helper interface for negotiation statistics
export interface NegotiationStats {
  pending_received: number
  pending_sent: number
  total_active: number
}

export interface CreateChildData {
  name: string
  email: string
}
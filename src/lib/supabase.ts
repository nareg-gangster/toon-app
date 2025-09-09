import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// For client components (main one we'll use)
export const supabase = createClient(supabaseUrl, supabaseKey)

// For client components with auth helpers
export const createClientSupabase = () => createClientComponentClient()

// Types for our database
export type Database = {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'parent' | 'child'
          avatar_url: string | null
          points: number
          family_id: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role?: 'parent' | 'child'
          avatar_url?: string | null
          points?: number
          family_id: string
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          points: number
          due_date: string | null
          status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected' | 'archived'
          category_id: string | null
          assigned_to: string
          created_by: string
          family_id: string
          created_at: string
          completed_at: string | null
          approved_at: string | null
          archived_at: string | null
          rejection_reason: string | null
          // New fields for repeated tasks
          is_recurring: boolean
          recurring_pattern: 'daily' | 'weekly' | 'monthly' | null
          recurring_time: string | null
          recurring_days: string[] | null
          recurring_day_of_week: number | null
          recurring_day_of_month: number | null
          parent_task_id: string | null
          recurring_rules: any | null
          penalty_points: number
          // New fields for task types and transfers
          task_type: 'negotiable' | 'non_negotiable' | 'hanging'
          transferable: boolean
          original_assignee: string | null
          transfer_history: any[] | null
          is_available_for_pickup: boolean
          // New negotiation fields
          negotiation_status: 'none' | 'being_negotiated' | 'transferred'
          point_split: { original_assignee: number; final_assignee: number } | null
          negotiation_history: any[]
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          points?: number
          due_date?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected' | 'archived'
          category_id?: string | null
          assigned_to: string
          created_by: string
          family_id: string
          created_at?: string
          completed_at?: string | null
          approved_at?: string | null
          archived_at?: string | null
          rejection_reason: string | null
          // New fields for repeated tasks
          is_recurring: boolean
          recurring_pattern: 'daily' | 'weekly' | 'monthly' | null
          recurring_time: string | null
          recurring_days: string[] | null
          recurring_day_of_week: number | null
          recurring_day_of_month: number | null
          parent_task_id: string | null
          recurring_rules: any | null
          penalty_points: number
          // New fields for task types and transfers
          task_type: 'negotiable' | 'non_negotiable' | 'hanging'
          transferable: boolean
          original_assignee: string | null
          transfer_history: any[] | null
          is_available_for_pickup: boolean
          // New negotiation fields
          negotiation_status: 'none' | 'being_negotiated' | 'transferred'
          point_split: { original_assignee: number; final_assignee: number } | null
          negotiation_history: any[]
        }
      }
      negotiations: {
        Row: {
          id: string
          task_id: string
          negotiation_type: 'sibling_transfer' | 'parent_negotiation'
          initiator_id: string
          recipient_id: string
          status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn'
          points_offered_to_recipient: number | null
          points_kept_by_initiator: number | null
          expires_at: string | null
          requested_points: number | null
          requested_due_date: string | null
          requested_description: string | null
          offer_message: string | null
          response_message: string | null
          created_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          negotiation_type: 'sibling_transfer' | 'parent_negotiation'
          initiator_id: string
          recipient_id: string
          status?: 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn'
          points_offered_to_recipient?: number | null
          points_kept_by_initiator?: number | null
          expires_at?: string | null
          requested_points?: number | null
          requested_due_date?: string | null
          requested_description?: string | null
          offer_message?: string | null
          response_message?: string | null
          created_at?: string
          responded_at?: string | null
        }
      }
      negotiation_messages: {
        Row: {
          id: string
          negotiation_id: string
          sender_id: string
          message_type: 'offer' | 'counter_offer' | 'acceptance' | 'rejection' | 'withdrawal'
          points_offered_to_recipient: number | null
          points_kept_by_initiator: number | null
          requested_points: number | null
          requested_due_date: string | null
          requested_description: string | null
          message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          negotiation_id: string
          sender_id: string
          message_type: 'offer' | 'counter_offer' | 'acceptance' | 'rejection' | 'withdrawal'
          points_offered_to_recipient?: number | null
          points_kept_by_initiator?: number | null
          requested_points?: number | null
          requested_due_date?: string | null
          requested_description?: string | null
          message?: string | null
          created_at?: string
        }
      }
    }
  }
}
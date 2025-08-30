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
          status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected'
          category_id: string | null
          assigned_to: string
          created_by: string
          family_id: string
          created_at: string
          completed_at: string | null
          approved_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          points?: number
          due_date?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected'
          category_id?: string | null
          assigned_to: string
          created_by: string
          family_id: string
          created_at?: string
          completed_at?: string | null
          approved_at?: string | null
        }
      }
    }
  }
}
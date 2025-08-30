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
  status: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected'
  due_date: string | null
  assigned_to: string
  created_by: string
  family_id: string
  created_at: string
  completed_at: string | null
  approved_at: string | null
  archived_at: string | null
  rejection_reason: string | null
  assigned_user?: {
    name: string
  }
  task_completions?: TaskCompletion[]
}

export interface TaskFilters {
  status: string
  dueDate: string
  assignedTo: string
  showArchived: boolean
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
}

export interface CreateChildData {
  name: string
  email: string
}
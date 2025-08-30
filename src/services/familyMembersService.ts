// Simplified familyMembersService.ts - Unified approach

import { supabase } from '@/lib/supabase'
import { User } from '@/types'

export interface CreateParentData {
  name: string
  email: string
}

export interface CreateChildData {
  name: string
  email: string
}

export interface FamilyInvitation {
  id: string
  email: string
  name: string
  role: 'parent' // Only parents have invitations
  family_id: string
  temp_password: string
  status: 'pending' | 'accepted' | 'expired'
  invited_by: string
  created_at: string
  expires_at: string
  accepted_at?: string
  user_id?: string
}

export interface ChildCreationResult {
  user: User
  temp_password: string
}

export interface FamilyMemberStats {
  totalPoints: number
  activeTasks: number
  completedTasks: number
  rank: number
}

export interface FamilyMemberWithStats extends User {
  stats?: FamilyMemberStats
}

export const familyMembersService = {
  async getFamilyMembers(familyId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('family_id', familyId)
      .order('role', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getFamilyMembersWithStats(familyId: string): Promise<FamilyMemberWithStats[]> {
    const members = await this.getFamilyMembers(familyId)
    
    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        if (member.role === 'child') {
          const { data: taskStats } = await supabase
            .from('tasks')
            .select('status')
            .eq('assigned_to', member.id)

          const activeTasks = taskStats?.filter(t => 
            ['pending', 'in_progress', 'completed'].includes(t.status)
          ).length || 0

          const completedTasks = taskStats?.filter(t => 
            t.status === 'approved'
          ).length || 0

          return {
            ...member,
            stats: {
              totalPoints: member.points || 0,
              activeTasks,
              completedTasks,
              rank: 0
            }
          }
        }
        return member
      })
    )

    const children = membersWithStats.filter(m => m.role === 'child')
    const sortedChildren = children.sort((a, b) => (b.points || 0) - (a.points || 0))
    
    sortedChildren.forEach((child, index) => {
      if (child.stats) {
        child.stats.rank = index + 1
      }
    })

    return membersWithStats
  },

  // UNIFIED CHILD CREATION - Used everywhere in the app
  async createChild(childData: CreateChildData, familyId: string): Promise<ChildCreationResult> {
    const tempPassword = this.generateTempPassword()
    
    try {
      // Validation: Check if child already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, family_id')
        .eq('email', childData.email)
        .single()

      if (existingUser) {
        if (existingUser.family_id === familyId) {
          throw new Error('This child is already part of your family')
        } else {
          throw new Error('A user with this email already exists in another family')
        }
      }

      // Store current session before any auth operations
      const { data: originalSession, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !originalSession?.session) {
        throw new Error('You must be logged in to create children')
      }

      const originalAccessToken = originalSession.session.access_token
      const originalRefreshToken = originalSession.session.refresh_token
      
      console.log('Stored original session for child creation')

      // Create the child's auth account (this will temporarily sign them in)
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: childData.email,
        password: tempPassword,
        options: {
          data: {
            name: childData.name,
            role: 'child',
            family_id: familyId
          }
        }
      })

      if (signUpError) {
        console.error('Auth signup error:', signUpError)
        throw new Error(`Failed to create account: ${signUpError.message}`)
      }

      if (!authData.user) {
        throw new Error('Failed to create user account')
      }

      console.log(`Created auth user: ${authData.user.id}`)

      // Create user record in database (while temporarily signed in as child)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: childData.email,
          name: childData.name,
          role: 'child',
          family_id: familyId,
          points: 0,
          password_changed: false // They'll be prompted to change on first login
        })
        .select()
        .single()

      if (userError) {
        console.error('User creation error:', userError)
        throw new Error(`Failed to create child profile: ${userError.message}`)
      }

      console.log('Created database user record')

      // CRITICAL: Restore original parent session immediately
      await supabase.auth.signOut()
      console.log('Signed out temporary child user')

      const { error: restoreError } = await supabase.auth.setSession({
        access_token: originalAccessToken,
        refresh_token: originalRefreshToken
      })

      if (restoreError) {
        console.error('Session restoration error:', restoreError)
        throw new Error('Failed to restore your session')
      }

      console.log('Restored original parent session')

      return {
        user: userData,
        temp_password: tempPassword
      }

    } catch (error: any) {
      console.error('Error creating child:', error)
      
      // Emergency session recovery
      try {
        const { data: currentSession } = await supabase.auth.getSession()
        if (!currentSession?.session) {
          console.log('No session found after error, may need to re-login')
        }
      } catch (recoveryError) {
        console.error('Emergency session recovery failed:', recoveryError)
      }
      
      throw error
    }
  },

  // PARENT INVITATION SYSTEM - Unchanged, only for parents
  async createParentInvitation(parentData: CreateParentData, familyId: string, invitedBy: string): Promise<FamilyInvitation> {
    const tempPassword = this.generateTempPassword()
    
    try {
      // Validation checks for parent invitations
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, family_id')
        .eq('email', parentData.email)
        .single()

      if (existingUser) {
        if (existingUser.family_id === familyId) {
          throw new Error('This user is already part of your family')
        } else {
          throw new Error('A user with this email already exists in another family')
        }
      }

      const { data: existingInvitation } = await supabase
        .from('family_invitations')
        .select('id')
        .eq('email', parentData.email)
        .eq('family_id', familyId)
        .eq('status', 'pending')
        .single()

      if (existingInvitation) {
        throw new Error('There is already a pending invitation for this email')
      }

      // Store current session
      const { data: originalSession, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !originalSession?.session) {
        throw new Error('You must be logged in to create invitations')
      }

      const originalAccessToken = originalSession.session.access_token
      const originalRefreshToken = originalSession.session.refresh_token

      // Create parent auth account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: parentData.email,
        password: tempPassword,
        options: {
          data: {
            name: parentData.name,
            role: 'parent',
            family_id: familyId
          }
        }
      })

      if (signUpError || !authData.user) {
        throw new Error(`Failed to create account: ${signUpError?.message}`)
      }

      // Create user record
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: parentData.email,
          name: parentData.name,
          role: 'parent',
          family_id: familyId,
          points: 0,
          password_changed: false
        })
        .select()
        .single()

      if (userError) {
        throw new Error(`Failed to create user record: ${userError.message}`)
      }

      // Restore session BEFORE creating invitation record
      await supabase.auth.signOut()
      await supabase.auth.setSession({
        access_token: originalAccessToken,
        refresh_token: originalRefreshToken
      })

      // Create invitation record (as restored parent)
      const { data: inviteData, error: inviteError } = await supabase
        .from('family_invitations')
        .insert({
          email: parentData.email,
          name: parentData.name,
          role: 'parent',
          family_id: familyId,
          temp_password: tempPassword,
          status: 'pending',
          invited_by: invitedBy,
          user_id: authData.user.id
        })
        .select()
        .single()

      if (inviteError) {
        throw new Error(`Failed to create invitation: ${inviteError.message}`)
      }

      return inviteData

    } catch (error: any) {
      console.error('Error creating parent invitation:', error)
      throw error
    }
  },

  // DEPRECATED: Remove this method, replace calls with createChild
  async createChildInvitation(childData: CreateChildData, familyId: string, invitedBy: string): Promise<ChildCreationResult> {
    console.warn('createChildInvitation is deprecated, use createChild instead')
    return this.createChild(childData, familyId)
  },

  async acceptInvitationOnLogin(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('family_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'pending')

      if (error) {
        console.error('Error accepting invitation:', error)
      }
    } catch (error) {
      console.error('Error in acceptInvitationOnLogin:', error)
    }
  },

  async getFamilyInvitations(familyId: string): Promise<FamilyInvitation[]> {
    const { data, error } = await supabase
      .from('family_invitations')
      .select('*')
      .eq('family_id', familyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async cancelInvitation(invitationId: string): Promise<void> {
    try {
      const { data: invitation, error: getError } = await supabase
        .from('family_invitations')
        .select('user_id')
        .eq('id', invitationId)
        .single()

      if (getError) {
        throw getError
      }

      // Delete user record first (only for pending invitations)
      if (invitation?.user_id) {
        const { error: deleteUserError } = await supabase
          .from('users')
          .delete()
          .eq('id', invitation.user_id)

        if (deleteUserError) {
          console.error('Error deleting user record:', deleteUserError)
        }
      }

      // Delete invitation
      const { error: deleteInviteError } = await supabase
        .from('family_invitations')
        .delete()
        .eq('id', invitationId)

      if (deleteInviteError) {
        throw deleteInviteError
      }

    } catch (error) {
      console.error('Error in cancelInvitation:', error)
      throw error
    }
  },

  generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let result = ''
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },

  async getFamilyInfo(familyId: string) {
    const { data, error } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .single()

    if (error) throw error
    return data
  },

  async updateFamilyInfo(familyId: string, updates: { name?: string }) {
    const { data, error } = await supabase
      .from('families')
      .update(updates)
      .eq('id', familyId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateFamilyMember(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
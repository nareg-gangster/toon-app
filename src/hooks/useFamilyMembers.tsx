import { useState, useEffect } from 'react'
import { 
  familyMembersService, 
  FamilyMemberWithStats, 
  CreateParentData, 
  CreateChildData,
  FamilyInvitation 
} from '@/services/familyMembersService'
import toast from 'react-hot-toast'

export const useFamilyMembers = (familyId?: string, currentUserId?: string) => {
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberWithStats[]>([])
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (familyId) {
      loadFamilyMembers()
      loadInvitations()
    }
  }, [familyId])

  const loadFamilyMembers = async () => {
    if (!familyId) return
    
    try {
      setLoading(true)
      const members = await familyMembersService.getFamilyMembersWithStats(familyId)
      setFamilyMembers(members)
    } catch (error) {
      console.error('Error loading family members:', error)
      toast.error('Error loading family members')
    } finally {
      setLoading(false)
    }
  }

  const loadInvitations = async () => {
    if (!familyId) return
    
    try {
      const invites = await familyMembersService.getFamilyInvitations(familyId)
      setInvitations(invites)
    } catch (error) {
      console.error('Error loading invitations:', error)
    }
  }

  const createParentInvitation = async (parentData: CreateParentData) => {
    if (!familyId || !currentUserId) return

    try {
      const invitation = await familyMembersService.createParentInvitation(
        parentData, 
        familyId, 
        currentUserId
      )
      setInvitations(prev => [invitation, ...prev])
      toast.success(`Invitation sent to ${parentData.name}! 📧`, {
        duration: 6000
      })
      return invitation
    } catch (error: any) {
      console.error('Error creating parent invitation:', error)
      toast.error(error.message || 'Error creating parent invitation')
      throw error
    }
  }

  const createChildInvitation = async (childData: CreateChildData) => {
    if (!familyId || !currentUserId) return

    try {
      const invitation = await familyMembersService.createChildInvitation(
        childData, 
        familyId, 
        currentUserId
      )
      setInvitations(prev => [invitation, ...prev])
      toast.success(`Invitation sent to ${childData.name}! 📧`, {
        duration: 6000
      })
      return invitation
    } catch (error: any) {
      console.error('Error creating child invitation:', error)
      toast.error(error.message || 'Error creating child invitation')
      throw error
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    try {
      await familyMembersService.cancelInvitation(invitationId)
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId))
      toast.success('Invitation cancelled')
    } catch (error: any) {
      console.error('Error cancelling invitation details:', {
        message: error?.message,
        error
      })
      toast.error(`Error cancelling invitation: ${error?.message || 'Unknown error'}`)
    }
  }

  const updateFamilyMember = async (userId: string, updates: any) => {
    try {
      const updatedMember = await familyMembersService.updateFamilyMember(userId, updates)
      setFamilyMembers(prev => prev.map(member => 
        member.id === userId ? { ...member, ...updatedMember } : member
      ))
      toast.success('Family member updated successfully')
      return updatedMember
    } catch (error) {
      console.error('Error updating family member:', error)
      toast.error('Error updating family member')
      throw error
    }
  }

  const parents = familyMembers.filter(member => member.role === 'parent')
  const children = familyMembers.filter(member => member.role === 'child')

  return {
    familyMembers,
    parents,
    children,
    invitations,
    loading,
    createParentInvitation,
    createChildInvitation,
    cancelInvitation,
    updateFamilyMember,
    refetchFamilyMembers: loadFamilyMembers,
    refetchInvitations: loadInvitations
  }
}
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useFamilyMembers } from '@/hooks/useFamilyMembers'
import AddParentModal from '@/components/family/AddParentModal'
import UnifiedChildModal from '@/components/family/UnifiedChildModal'
import PasswordChangeModal from '@/components/PasswordChangeModal'
import { ProfilePictureUpload } from '@/components/ProfilePictureUpload'
import { Avatar } from '@/components/ui/avatar'
import { familyMembersService } from '@/services/familyMembersService'
import { Users, UserPlus, Baby, Settings, Key, Crown, Star, Mail, Clock, X, LogOut } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ParentProfilePage() {
  const { user, requireAuth, signOut } = useAuth()
  const { 
    familyMembers, 
    parents, 
    children, 
    invitations, // Add this
    loading, 
    createParentInvitation, // Changed from createParent
    createChildInvitation, // Changed from createChild
    cancelInvitation, // Add this
    refetchFamilyMembers 
  } = useFamilyMembers(user?.family_id, user?.id) // Pass user ID

  const [familyInfo, setFamilyInfo] = useState<any>(null)
  const [familyName, setFamilyName] = useState('')
  const [showAddParent, setShowAddParent] = useState(false)
  const [showAddChild, setShowAddChild] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [submittingParent, setSubmittingParent] = useState(false)
  const [submittingChild, setSubmittingChild] = useState(false)
  const [updatingFamily, setUpdatingFamily] = useState(false)
  const [showInvitationDetails, setShowInvitationDetails] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState(user)

  useEffect(() => {
    requireAuth('parent')
    if (user?.family_id) {
      loadFamilyInfo()
    }
    setCurrentUser(user)
  }, [user])

  const loadFamilyInfo = async () => {
    if (!user?.family_id) return
    
    try {
      const family = await familyMembersService.getFamilyInfo(user.family_id)
      setFamilyInfo(family)
      setFamilyName(family.name || '')
    } catch (error) {
      console.error('Error loading family info:', error)
    }
  }

  const handleAddParent = async (parentData: { name: string; email: string }) => {
    setSubmittingParent(true)
    try {
      const invitation = await createParentInvitation(parentData)
      console.log('Parent invitation created:', invitation)
      // Show invitation details to user
      setShowInvitationDetails({
        ...invitation,
        type: 'parent'
      })
    } catch (error) {
      // Error handling in hook
    } finally {
      setSubmittingParent(false)
    }
  }

  const handleAddChild = async (childData: { name: string; email: string }) => {
    try {
      const result = await familyMembersService.createChild(childData, user.family_id)
      console.log('Child created:', result)
      
      // DON'T call refetchFamilyMembers here - let the modal handle the success flow first
      // refetchFamilyMembers() // Remove this line
      
      return result
    } catch (error) {
      throw error
    }
  }

  const handleUpdateFamilyName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.family_id || !familyName.trim()) return

    setUpdatingFamily(true)
    try {
      await familyMembersService.updateFamilyInfo(user.family_id, { name: familyName.trim() })
      setFamilyInfo((prev: any) => ({ ...prev, name: familyName.trim() }))
      toast.success('Family name updated! 👨‍👩‍👧‍👦')
    } catch (error) {
      console.error('Error updating family name:', error)
      toast.error('Error updating family name')
    } finally {
      setUpdatingFamily(false)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation(invitationId)
    } catch (error) {
      // Error handling in hook
    }
  }

  const getRoleIcon = (role: string) => {
    return role === 'parent' ? <Crown className="w-4 h-4" /> : <Star className="w-4 h-4" />
  }

  const getChildRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'  
      case 3: return '🥉'
      default: return '⭐'
    }
  }

  const handleAvatarUpdate = (newAvatarUrl: string | null) => {
    setCurrentUser((prev: any) => ({ ...prev, avatar_url: newAvatarUrl }))
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }
  

  return (
    <>
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Mobile Header */}
        <div className="flex justify-between items-center mb-6 md:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Family Profile</h1>
            <p className="text-sm text-gray-600">Manage family settings</p>
          </div>
          <Link href="/dashboard/parent">
            <Button variant="outline">← Back</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Family Info & Settings */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Profile Picture Section */}
            <Card>
              <CardHeader>
                <CardTitle>Your Profile</CardTitle>
                <CardDescription>Update your profile picture and info</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <ProfilePictureUpload
                  userId={currentUser?.id || ''}
                  currentAvatarUrl={currentUser?.avatar_url}
                  userName={currentUser?.name || ''}
                  onUpdate={handleAvatarUpdate}
                  size="xl"
                />
                <div className="text-center">
                  <h3 className="font-semibold text-lg">{currentUser?.name}</h3>
                  <p className="text-sm text-gray-600">{currentUser?.email}</p>
                  <Badge className="mt-2 bg-purple-100 text-purple-800">Parent</Badge>
                </div>
              </CardContent>
            </Card>
            
            {/* Family Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Family Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                <form onSubmit={handleUpdateFamilyName} className="space-y-3">
                  <div>
                    <Label htmlFor="familyName">Family Name</Label>
                    <Input
                      id="familyName"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder="The Johnson Family"
                      disabled={updatingFamily}
                    />
                  </div>
                  <Button type="submit" disabled={updatingFamily} className="w-full">
                    {updatingFamily ? 'Updating...' : 'Update Family Name'}
                  </Button>
                </form>

                <div className="pt-4 border-t space-y-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPasswordModal(true)}
                    className="w-full"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={signOut}
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>

              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Add Family Members
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => setShowAddParent(true)}
                  className="w-full"
                  variant="outline"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Add Another Parent
                </Button>
                <Button 
                  onClick={() => setShowAddChild(true)}
                  className="w-full"
                >
                  <Baby className="w-4 h-4 mr-2" />
                  Add Child
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Both parents have equal management permissions
                </p>
              </CardContent>
            </Card>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Mail className="w-5 h-5 mr-2" />
                    Pending Invitations ({invitations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{invitation.name}</p>
                            <p className="text-sm text-gray-600">{invitation.email}</p>
                            <p className="text-xs text-gray-500 flex items-center mt-1">
                              <Clock className="w-3 h-3 mr-1" />
                              Expires {new Date(invitation.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary">
                              {invitation.role}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelInvitation(invitation.id)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>

          {/* Family Overview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>👨‍👩‍👧‍👦 Family Overview</CardTitle>
                <CardDescription>
                  {familyMembers.length} family members • {parents.length} parents • {children.length} children
                  {invitations.length > 0 && ` • ${invitations.length} pending invitations`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                
                {/* Parents Section */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Crown className="w-4 h-4 mr-2" />
                      Parents ({parents.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {parents.map((parent) => (
                        <div key={parent.id} className="border rounded-lg p-4">
                          <div className="flex items-start space-x-3">
                            <Avatar 
                              src={parent.avatar_url} 
                              alt={parent.name}
                              size="md"
                              fallbackName={parent.name}
                            />
                            <div className="flex-1">
                              <h4 className="font-medium flex items-center">
                                {parent.name}
                                {parent.id === user.id && (
                                  <Badge variant="secondary" className="ml-2">You</Badge>
                                )}
                              </h4>
                              <p className="text-sm text-gray-600">{parent.email}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Joined {new Date(parent.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge className="bg-purple-100 text-purple-800">
                              Parent
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Children Section */}
                  {children.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                        <Star className="w-4 h-4 mr-2" />
                        Children ({children.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {children
                          .sort((a, b) => (b.points || 0) - (a.points || 0))
                          .map((child, index) => (
                          <div key={child.id} className="border rounded-lg p-4">
                            <div className="flex items-start space-x-3 mb-3">
                              <div className="relative">
                                <Avatar 
                                  src={child.avatar_url} 
                                  alt={child.name}
                                  size="md"
                                  fallbackName={child.name}
                                />
                                <div className="absolute -top-1 -right-1 text-sm">
                                  {getChildRankEmoji(index + 1)}
                                </div>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium">
                                  {child.name}
                                </h4>
                                <p className="text-sm text-gray-600">{child.email}</p>
                              </div>
                              <Badge className="bg-blue-100 text-blue-800">
                                Child
                              </Badge>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Points:</span>
                                <span className="font-bold text-blue-600">{child.points || 0}</span>
                              </div>
                              {child.stats && (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Active Tasks:</span>
                                    <span className="font-medium">{child.stats.activeTasks}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Completed:</span>
                                    <span className="font-medium text-green-600">{child.stats.completedTasks}</span>
                                  </div>
                                </>
                              )}
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Rank:</span>
                                <span className="font-medium">#{index + 1}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {children.length === 0 && invitations.filter(i => i.role === 'child').length === 0 && (
                    <div className="text-center py-8">
                      <Baby className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="font-medium text-gray-900 mb-2">No children added yet</h3>
                      <p className="text-gray-600 mb-4">Add children to start managing tasks and rewards!</p>
                      <Button onClick={() => setShowAddChild(true)}>
                        Add Your First Child
                      </Button>
                    </div>
                  )}

                </div>

              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* Modals */}
      <AddParentModal
        isOpen={showAddParent}
        onClose={() => setShowAddParent(false)}
        onSubmit={handleAddParent}
        submitting={submittingParent}
      />

      <UnifiedChildModal
        isOpen={showAddChild}
        onClose={() => {
          setShowAddChild(false)
          // Refresh family members when modal closes
          refetchFamilyMembers()
        }}
        onSubmit={handleAddChild}
        //onSendEmail={onSendEmail} // Your existing email function
        submitting={submittingChild}
      />

      <PasswordChangeModal
        isOpen={showPasswordModal}
        onComplete={() => setShowPasswordModal(false)}
        onClose={() => setShowPasswordModal(false)}
        userName={user.name}
        isFirstLogin={false}
      />

      {/* Invitation Details Modal */}
      {showInvitationDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Mail className="w-5 h-5 mr-2" />
                  Invitation Created!
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInvitationDetails(null)}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900">Share these details with {showInvitationDetails.name}:</h3>
                <div className="mt-3 space-y-2">
                  <div>
                    <span className="text-sm font-medium text-green-800">Email:</span>
                    <p className="text-sm text-green-700">{showInvitationDetails.email}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-green-800">Temporary Password:</span>
                    <p className="text-sm font-mono bg-green-100 p-2 rounded text-green-700">
                      {showInvitationDetails.temp_password}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Instructions:</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>They can now <strong>sign in</strong> with these credentials</li>
                    <li>No need to sign up - the account is already created!</li>
                    <li>They'll be prompted to set their own password on first login</li>
                    <li>They'll automatically have access to your family!</li>
                    </ol>
              </div>

              <Button onClick={() => setShowInvitationDetails(null)} className="w-full">
                Got it!
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
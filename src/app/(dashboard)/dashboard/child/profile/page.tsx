'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useFamilyMembers } from '@/hooks/useFamilyMembers'
import PasswordChangeModal from '@/components/PasswordChangeModal'
import { ProfilePictureUpload } from '@/components/ProfilePictureUpload'
import { Avatar } from '@/components/ui/avatar'
import { User, Key, Trophy, Target, Star, Crown, LogOut } from 'lucide-react'
import Link from 'next/link'

export default function ChildProfilePage() {
  const { user, requireAuth, signOut } = useAuth()
  const { 
    familyMembers, 
    parents, 
    children, 
    loading 
  } = useFamilyMembers(user?.family_id)

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentUser, setCurrentUser] = useState(user)

  useEffect(() => {
    requireAuth('child')
    setCurrentUser(user)
  }, [user])

  const getChildRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'  
      case 3: return '🥉'
      default: return '⭐'
    }
  }

  const getMyRank = () => {
    if (!user) return 0
    const sortedChildren = children
      .sort((a, b) => (b.points || 0) - (a.points || 0))
    return sortedChildren.findIndex(child => child.id === user.id) + 1
  }

  const getMyStats = () => {
    const myData = children.find(child => child.id === user?.id)
    return myData?.stats || {
      totalPoints: user?.points || 0,
      activeTasks: 0,
      completedTasks: 0,
      rank: getMyRank()
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

  const myStats = getMyStats()
  const myRank = getMyRank()

  return (
    <>
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Mobile Header */}
        <div className="flex justify-between items-center mb-6 md:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="text-sm text-gray-600">View your stats and family</p>
          </div>
          <Link href="/dashboard/child">
            <Button variant="outline">← Back</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* My Stats & Settings */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* My Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  My Profile
                </CardTitle>
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
                  <h3 className="font-medium text-lg">{currentUser?.name}</h3>
                  <p className="text-gray-600 text-sm">{currentUser?.email}</p>
                  <Badge className="mt-2 bg-blue-100 text-blue-800">Child</Badge>
                </div>

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

            {/* My Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="w-5 h-5 mr-2" />
                  My Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  
                  {/* Points */}
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {user.points || 0}
                    </div>
                    <div className="text-sm text-blue-700">Total Points</div>
                  </div>

                  {/* Other Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <div className="text-xl font-bold text-yellow-600">
                        {myStats.activeTasks}
                      </div>
                      <div className="text-xs text-yellow-700">Active Tasks</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-xl font-bold text-green-600">
                        {myStats.completedTasks}
                      </div>
                      <div className="text-xs text-green-700">Completed</div>
                    </div>
                  </div>

                  {/* Family Rank */}
                  {children.length > 1 && (
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-2xl mb-1">
                        {getChildRankEmoji(myRank)}
                      </div>
                      <div className="font-bold text-purple-600">Rank #{myRank}</div>
                      <div className="text-xs text-purple-700">
                        out of {children.length} children
                      </div>
                    </div>
                  )}

                </div>
              </CardContent>
            </Card>

          </div>

          {/* Family Overview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>👨‍👩‍👧‍👦 My Family</CardTitle>
                <CardDescription>
                  {familyMembers.length} family members • See how everyone is doing!
                </CardDescription>
              </CardHeader>
              <CardContent>
                
                <div className="space-y-6">
                  
                  {/* Parents */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Crown className="w-4 h-4 mr-2" />
                      Parents ({parents.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {parents.map((parent) => (
                        <div key={parent.id} className="border rounded-lg p-4">
                          <div className="flex items-center space-x-3">
                            <Avatar 
                              src={parent.avatar_url} 
                              alt={parent.name}
                              size="md"
                              fallbackName={parent.name}
                            />
                            <div className="flex-1">
                              <h4 className="font-medium">{parent.name}</h4>
                              <p className="text-sm text-gray-600">Family Manager</p>
                            </div>
                            <Badge className="bg-purple-100 text-purple-800">
                              <Crown className="w-3 h-3 mr-1" />
                              Parent
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Other Children */}
                  {children.length > 1 && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                        <Star className="w-4 h-4 mr-2" />
                        My Siblings ({children.length - 1})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {children
                          .filter(child => child.id !== user.id) // Exclude self
                          .sort((a, b) => (b.points || 0) - (a.points || 0))
                          .map((child, index) => {
                            // Calculate actual rank including self
                            const allSorted = children.sort((a, b) => (b.points || 0) - (a.points || 0))
                            const actualRank = allSorted.findIndex(c => c.id === child.id) + 1
                            
                            return (
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
                                      {getChildRankEmoji(actualRank)}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium">
                                      {child.name}
                                    </h4>
                                    <p className="text-xs text-gray-500">Rank #{actualRank}</p>
                                  </div>
                                  <Badge className="bg-blue-100 text-blue-800">
                                    Sibling
                                  </Badge>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Points:</span>
                                    <span className="font-bold text-blue-600">
                                      {child.points || 0}
                                    </span>
                                  </div>
                                  {child.stats && (
                                    <>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Active Tasks:</span>
                                        <span className="font-medium">{child.stats.activeTasks}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Completed:</span>
                                        <span className="font-medium text-green-600">
                                          {child.stats.completedTasks}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Only Child */}
                  {children.length === 1 && (
                    <div className="text-center py-8">
                      <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="font-medium text-gray-900 mb-2">You're the only child!</h3>
                      <p className="text-gray-600">
                        Maybe your parents will add more siblings to compete with! 😄
                      </p>
                    </div>
                  )}

                  {/* Family Stats Summary */}
                  {children.length > 1 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Family Competition</h4>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="font-bold text-gray-900">
                            {Math.max(...children.map(c => c.points || 0))}
                          </div>
                          <div className="text-xs text-gray-600">Highest Points</div>
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">
                            {children.reduce((sum, c) => sum + (c.points || 0), 0)}
                          </div>
                          <div className="text-xs text-gray-600">Total Family Points</div>
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">
                            {Math.round(children.reduce((sum, c) => sum + (c.points || 0), 0) / children.length)}
                          </div>
                          <div className="text-xs text-gray-600">Average Points</div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* Password Change Modal */}
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onComplete={() => setShowPasswordModal(false)}
        onClose={() => setShowPasswordModal(false)} 
        userName={user.name}
        isFirstLogin={false}
      />
    </>
  )
}
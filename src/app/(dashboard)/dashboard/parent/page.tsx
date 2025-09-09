'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import PasswordChangeModal from '@/components/PasswordChangeModal'
import toast, { Toaster } from 'react-hot-toast'

interface UserData {
  id: string
  name: string
  email: string
  role: string
  family_id: string
}

interface FamilyMember {
  id: string
  name: string
  role: string
  points: number
  avatar_url?: string | null
}

export default function ParentDashboard() {
  const { user, loading, signOut } = useAuth()
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    console.log('🔍 Dashboard user check:', {
      user: user,
      hasUser: !!user,
      passwordChanged: user?.password_changed,
      shouldShowModal: user && !user.password_changed
    })
    
    if (user && !user.password_changed) {
      console.log('📱 Should show password modal for:', user.name)
      setShowPasswordModal(true)
    }
  }, [user])
  
  useEffect(() => {
    if (user?.family_id) {
      loadFamilyMembers()
    }
  }, [user])

  const loadFamilyMembers = async () => {
    if (!user?.family_id) return
    
    const { data: familyData, error } = await supabase
      .from('users')
      .select('id, name, role, points, avatar_url')
      .eq('family_id', user.family_id)
      .order('role', { ascending: false })
  
    if (error) {
      console.error('Family data error:', error)
    } else if (familyData) {
      setFamilyMembers(familyData)
    }
  }


  const handleSignOut = async () => {
    await signOut()
  }
  
  const handlePasswordChangeComplete = async () => {
    setShowPasswordModal(false)
    window.location.reload()
  }

  const handleCreateTestChild = async () => {
    if (!user) return
    
    try {
      // Generate a unique child name
      const childNumber = familyMembers.filter(m => m.role === 'child').length + 1
      const childName = `Child ${childNumber}`
      
      const { data: childUser, error } = await supabase
        .from('users')
        .insert({
          id: crypto.randomUUID(),
          email: `child${childNumber}@${user.email.split('@')[1]}`,
          name: childName,
          role: 'child',
          family_id: user.family_id,
          points: 0
        })
        .select()
        .single()
  
      if (error) {
        toast.error('Error creating child')
        console.error('Child creation error:', error)
      } else {
        toast.success(`${childName} added to family! 👶`)
        // Refresh family members
        checkUser()
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Something went wrong')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Unable to load your profile</p>
          <div className="space-x-4">
            <Button onClick={() => router.push('/auth/signin')}>
              Back to Sign In
            </Button>
            <Button onClick={() => router.push('/auth/register')} variant="outline">
              Register Again
            </Button>
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      
      {/* Mobile Header */}
      <div className="md:hidden mb-6">
        <div className="bg-white shadow-sm border-b px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Parent Dashboard</h1>
          <p className="text-sm text-gray-600">Welcome, {user?.name}!</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Family Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                👨‍👩‍👧‍👦 Family Members
              </CardTitle>
              <CardDescription>
                {familyMembers.length} members in your family
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {familyMembers.length > 0 ? (
                  familyMembers.map((member) => (
                    <div key={member.id} className="flex items-center space-x-3">
                      <Avatar 
                        src={member.avatar_url} 
                        alt={member.name}
                        size="md"
                        fallbackName={member.name}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-gray-600 capitalize">{member.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">{member.points}</p>
                        <p className="text-xs text-gray-500">points</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No family members found</p>
                )}
              </div>
              <Link href="/dashboard/parent/children">
                <Button className="w-full mt-4" variant="outline">
                    Manage Children
                </Button>
                </Link>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                ⚡ Quick Actions
              </CardTitle>
              <CardDescription>
                Common parent tasks
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <Link href="/dashboard/parent/tasks" className="block">
                <Button className="w-full justify-start">
                  📝 Manage Tasks
                </Button>
              </Link>
              <Link href="/dashboard/parent/rewards" className="block">
                <Button className="w-full justify-start" variant="outline">
                  🎁 Manage Rewards
                </Button>
              </Link>
              <Link href="/dashboard/parent/children" className="block">
                <Button className="w-full justify-start" variant="outline">
                  👨‍👩‍👧‍👦 View Family
                </Button>
              </Link>
              <Link href="/dashboard/parent/profile" className="block">
                <Button className="w-full justify-start" variant="outline">
                  👤 Family Profile
                </Button>
              </Link>
              <Button className="w-full justify-start" variant="outline">
                📊 View Reports
              </Button>
            </CardContent>
          </Card>

          {/* Today's Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                📈 Today's Activity
              </CardTitle>
              <CardDescription>
                What's happening today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  No activity yet today
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Create some tasks to get started!
                </p>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>

      <PasswordChangeModal
        isOpen={showPasswordModal}
        onComplete={handlePasswordChangeComplete}
        userName={user?.name || ''}
        isFirstLogin={true}
      />
      
    </div>
  )
}
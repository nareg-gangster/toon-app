// Updated app/(dashboard)/dashboard/parent/children/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import Link from 'next/link'
import UnifiedChildModal from '@/components/family/UnifiedChildModal'
import { sendChildLoginEmail } from '@/lib/emailService'
import { familyMembersService } from '@/services/familyMembersService'

interface Child {
  id: string
  name: string
  email: string
  points: number
  created_at: string
}

export default function ChildrenManagementPage() {
  const [user, setUser] = useState<any>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showChildModal, setShowChildModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    initializePage()
  }, [])

  const initializePage = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/auth/signin')
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (!userData || userData.role !== 'parent') {
        router.push('/auth/signin')
        return
      }

      setUser(userData)

      // Get children
      const { data: childrenData } = await supabase
        .from('users')
        .select('*')
        .eq('family_id', userData.family_id)
        .eq('role', 'child')
        .order('created_at', { ascending: false })

      setChildren(childrenData || [])

    } catch (error) {
      console.error('Error loading page:', error)
      toast.error('Error loading children')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateChild = async (childData: { name: string; email: string }) => {
    setCreating(true)
    try {
      console.log('Creating child account:', childData)

      // Use the unified service method
      const result = await familyMembersService.createChild(childData, user.family_id)
      
      toast.success(`${childData.name} added to family!`)

      // Refresh children list
      setChildren(prev => [result.user, ...prev])

      return result

    } catch (error: any) {
      console.error('Error creating child:', error)
      toast.error(error.message || 'Something went wrong')
      throw error
    } finally {
      setCreating(false)
    }
  }

  const handleSendEmail = async (email: string, name: string, password: string) => {
    return await sendChildLoginEmail(email, name, password, user?.name || 'Parent')
  }

  const handleDeleteChild = async (childId: string, childName: string) => {
    if (!confirm(`Are you sure you want to remove ${childName} from the family?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', childId)

      if (error) {
        toast.error('Error removing child')
        return
      }

      toast.success(`${childName} removed from family`)
      setChildren(prev => prev.filter(child => child.id !== childId))

    } catch (error) {
      console.error('Error deleting child:', error)
      toast.error('Something went wrong')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading children...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="hidden md:flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Manage Children</h1>
              <p className="text-sm text-gray-600">Add and manage your family members</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/parent">
                <Button variant="outline">← Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Add Child Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Add New Child
                <Button size="sm" onClick={() => setShowChildModal(true)}>
                  + Add Child
                </Button>
              </CardTitle>
              <CardDescription>
                Create accounts for your children to complete tasks and earn rewards
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Children List */}
          <Card>
            <CardHeader>
              <CardTitle>Family Children</CardTitle>
              <CardDescription>
                {children.length} children in your family
              </CardDescription>
            </CardHeader>
            <CardContent>
              {children.length > 0 ? (
                <div className="space-y-4">
                  {children.map((child) => (
                    <div key={child.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{child.name}</h3>
                          <p className="text-sm text-gray-600">{child.email}</p>
                          <p className="text-sm font-bold text-blue-600">{child.points} points</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleDeleteChild(child.id, child.name)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No children added yet</p>
                  <p className="text-sm text-gray-400 mt-2">Add your first child to get started!</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>

      {/* Unified Child Creation Modal */}
      <UnifiedChildModal
        isOpen={showChildModal}
        onClose={() => setShowChildModal(false)}
        onSubmit={handleCreateChild}
        onSendEmail={handleSendEmail}
        submitting={creating}
      />
    </div>
  )
}
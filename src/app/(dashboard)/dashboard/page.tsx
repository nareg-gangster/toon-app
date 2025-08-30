'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useFamilyMembers } from '@/hooks/useFamilyMembers'

export default function ParentDashboard() {
  const { user, requireAuth } = useAuth()
  const { familyMembers, loading, createTestChild } = useFamilyMembers(user?.family_id)

  useEffect(() => {
    // Only check auth after user data has loaded
    if (!loading) {
      requireAuth('parent')
    }
  }, [loading, user]) // Add user to dependencies

  if (!user) return null

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 md:hidden">Family Tasks</h1>
        <p className="text-gray-600 md:hidden">Parent Dashboard</p>
      </div>

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
              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : familyMembers.length > 0 ? (
                familyMembers.map((member) => (
                  <div key={member.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-gray-600 capitalize">{member.role}</p>
                    </div>
                    <div className="text-right flex items-center space-x-2">
                      <div className="text-right">
                        <p className="font-bold text-blue-600">{member.points}</p>
                        <p className="text-xs text-gray-500">points</p>
                      </div>
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
                📝 Tasks
              </Button>
            </Link>
            <Link href="/dashboard/parent/children" className="block">
              <Button className="w-full justify-start" variant="outline">
                👨‍👩‍👧‍👦 Manage Children
              </Button>
            </Link>
            <Button className="w-full justify-start" variant="outline">
              ✅ Review Completed Tasks
            </Button>
            <Button className="w-full justify-start" variant="outline">
              🎁 Manage Rewards
            </Button>
            <Button className="w-full justify-start" variant="outline">
              📊 View Family Progress
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
    </div>
  )
}
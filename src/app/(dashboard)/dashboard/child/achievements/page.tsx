'use client'

import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useFamilyMembers } from '@/hooks/useFamilyMembers'
import { Trophy, Star, Target, Award, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function ChildAchievementsPage() {
  const { user, requireAuth } = useAuth()
  const { children, loading } = useFamilyMembers(user?.family_id)

  useEffect(() => {
    requireAuth('child')
  }, [user])

  const getMyRank = () => {
    if (!user || !children.length) return 0
    const sortedChildren = children.sort((a, b) => (b.points || 0) - (a.points || 0))
    return sortedChildren.findIndex(child => child.id === user.id) + 1
  }

  const getAchievements = () => {
    const points = user?.points || 0
    const achievements = []

    // Points-based achievements
    if (points >= 10) achievements.push({ icon: '🎯', title: 'First Steps', desc: 'Earned your first 10 points' })
    if (points >= 50) achievements.push({ icon: '⭐', title: 'Rising Star', desc: 'Reached 50 points' })
    if (points >= 100) achievements.push({ icon: '🚀', title: 'Sky High', desc: 'Soared to 100 points' })
    if (points >= 250) achievements.push({ icon: '👑', title: 'Point Master', desc: 'Accumulated 250 points' })
    if (points >= 500) achievements.push({ icon: '💎', title: 'Diamond Member', desc: 'Legendary 500 points!' })

    // Rank-based achievements
    const rank = getMyRank()
    if (rank === 1 && children.length > 1) achievements.push({ icon: '🥇', title: 'Family Champion', desc: 'Top performer in the family' })
    if (rank === 2 && children.length > 2) achievements.push({ icon: '🥈', title: 'Silver Achiever', desc: 'Second place in family rankings' })
    if (rank === 3 && children.length > 3) achievements.push({ icon: '🥉', title: 'Bronze Winner', desc: 'Third place in family rankings' })

    return achievements
  }

  if (!user) return null

  const achievements = getAchievements()
  const myRank = getMyRank()

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Mobile Header */}
      <div className="flex justify-between items-center mb-6 md:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Achievements</h1>
          <p className="text-sm text-gray-600">Your progress and stats</p>
        </div>
        <Link href="/dashboard/child">
          <Button variant="outline">← Back</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Stats Overview */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                My Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-4xl font-bold text-blue-600">{user.points || 0}</div>
                  <div className="text-sm text-blue-700">Total Points</div>
                </div>

                {children.length > 1 && (
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-3xl mb-2">
                      {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '⭐'}
                    </div>
                    <div className="font-bold text-purple-600">Rank #{myRank}</div>
                    <div className="text-sm text-purple-700">out of {children.length}</div>
                  </div>
                )}

                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{achievements.length}</div>
                  <div className="text-sm text-green-700">Achievements Unlocked</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievements */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="w-5 h-5 mr-2" />
                Achievements
              </CardTitle>
              <CardDescription>
                {achievements.length} achievements unlocked
              </CardDescription>
            </CardHeader>
            <CardContent>
              {achievements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {achievements.map((achievement, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gradient-to-br from-yellow-50 to-orange-50">
                      <div className="flex items-start space-x-3">
                        <div className="text-3xl">{achievement.icon}</div>
                        <div>
                          <h3 className="font-medium text-gray-900">{achievement.title}</h3>
                          <p className="text-sm text-gray-600">{achievement.desc}</p>
                          <Badge className="mt-2 bg-yellow-100 text-yellow-800">Unlocked!</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No achievements yet</h3>
                  <p className="text-gray-600 mb-4">Complete tasks to start earning achievements!</p>
                  <Link href="/dashboard/child/tasks">
                    <Button>View My Tasks</Button>
                  </Link>
                </div>
              )}

              {/* Upcoming Achievements */}
              {achievements.length > 0 && (
                <div className="mt-8 pt-6 border-t">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                    <Target className="w-4 h-4 mr-2" />
                    Coming Up Next
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Show next point milestone */}
                    {(user.points || 0) < 500 && (
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <div className="text-2xl opacity-50">
                            {(user.points || 0) < 10 ? '🎯' : 
                             (user.points || 0) < 50 ? '⭐' : 
                             (user.points || 0) < 100 ? '🚀' : 
                             (user.points || 0) < 250 ? '👑' : '💎'}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-600">
                              {(user.points || 0) < 10 ? 'First Steps' : 
                               (user.points || 0) < 50 ? 'Rising Star' : 
                               (user.points || 0) < 100 ? 'Sky High' : 
                               (user.points || 0) < 250 ? 'Point Master' : 'Diamond Member'}
                            </h4>
                            <p className="text-sm text-gray-500">
                              Need {(user.points || 0) < 10 ? 10 - (user.points || 0) : 
                                    (user.points || 0) < 50 ? 50 - (user.points || 0) : 
                                    (user.points || 0) < 100 ? 100 - (user.points || 0) : 
                                    (user.points || 0) < 250 ? 250 - (user.points || 0) : 500 - (user.points || 0)} more points
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
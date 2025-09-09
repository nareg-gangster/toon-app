'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useRewards } from '@/hooks/useRewards'
import RewardCard from '@/components/rewards/RewardCard'
import RewardModal from '@/components/rewards/RewardModal'
import { CreateRewardData } from '@/services/rewardsService'
import Link from 'next/link'

export default function ParentRewardsPage() {
  const { user, requireAuth } = useAuth()
  const { 
    rewards, 
    redemptions, 
    loading, 
    createReward, 
    updateReward, 
    deleteReward,
    approveRedemption,
    denyRedemption,
    refetchAllRewards 
  } = useRewards(user?.family_id)
  
  const [showModal, setShowModal] = useState(false)
  const [editingReward, setEditingReward] = useState<any>(null)

  useEffect(() => {
    requireAuth('parent')
    if (user?.family_id) {
      refetchAllRewards() // Load all rewards including inactive ones
    }
  }, [user])

  const handleCreateReward = async (rewardData: CreateRewardData) => {
    await createReward(rewardData)
    setShowModal(false)
  }

  const handleEditReward = async (rewardData: CreateRewardData) => {
    if (editingReward) {
      await updateReward(editingReward.id, rewardData)
      setEditingReward(null)
      setShowModal(false)
    }
  }

  const handleDeleteReward = async (rewardId: string) => {
    if (confirm('Are you sure you want to delete this reward?')) {
      await deleteReward(rewardId)
    }
  }

  const handleEditClick = (reward: any) => {
    setEditingReward(reward)
    setShowModal(true)
  }

  const pendingRedemptions = redemptions.filter(r => r.status === 'pending')

  if (!user) return null

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rewards...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Mobile Header - Hidden since we now have GlobalHeader on mobile */}
      <div className="hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rewards</h1>
          <p className="text-sm text-gray-600">Manage family rewards</p>
        </div>
        <Link href="/dashboard/parent">
          <Button variant="outline">← Back</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Pending Redemptions */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                🔔 Pending Approvals
                {pendingRedemptions.length > 0 && (
                  <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">
                    {pendingRedemptions.length}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Children waiting for reward approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRedemptions.length > 0 ? (
                <div className="space-y-4">
                  {pendingRedemptions.map((redemption) => (
                    <div key={redemption.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{redemption.reward.name}</h4>
                          <p className="text-sm text-gray-600">{redemption.users.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(redemption.redeemed_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="font-bold text-blue-600">
                          {redemption.points_spent} pts
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          onClick={() => approveRedemption(redemption.id)}
                          className="flex-1"
                        >
                          ✅ Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => denyRedemption(redemption.id, redemption.user_id, redemption.points_spent)}
                          className="flex-1"
                        >
                          ❌ Deny
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">No pending redemptions</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rewards Management */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                🎁 Family Rewards
                <Button onClick={() => setShowModal(true)}>
                  + Add Reward
                </Button>
              </CardTitle>
              <CardDescription>
                {rewards.length} rewards in your family catalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rewards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      userPoints={0} // Not relevant for parents
                      isParent={true}
                      onEdit={handleEditClick}
                      onDelete={handleDeleteReward}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No rewards created yet</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Create rewards for your children to earn with their points!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Reward Creation/Edit Modal */}
      <RewardModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingReward(null)
        }}
        onSubmit={editingReward ? handleEditReward : handleCreateReward}
        editingReward={editingReward}
      />
    </div>
  )
}
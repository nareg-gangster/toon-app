'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useRewards } from '@/hooks/useRewards'
import RewardCard from '@/components/rewards/RewardCard'
import toast from 'react-hot-toast'

export default function ChildRewardsPage() {
  const { user, requireAuth } = useAuth()
  const { 
    rewards, 
    redemptions, 
    loading, 
    redeemReward 
  } = useRewards(user?.family_id, user?.id)

  useEffect(() => {
    requireAuth('child')
  }, [user])

  const handleRedeemReward = async (rewardId: string) => {
    const reward = rewards.find(r => r.id === rewardId)
    if (!reward) return

    // Show confirmation toast
    toast((t) => (
      <div className="flex flex-col space-y-3">
        <div>
          <p className="font-medium">Redeem "{reward.name}"?</p>
          <p className="text-sm text-gray-600">Cost: {reward.cost} points</p>
          <p className="text-xs text-blue-600 mt-1">⚠️ This will need parent approval</p>
        </div>
        <div className="flex space-x-2">
          <Button
            size="sm"
            onClick={async () => {
              toast.dismiss(t.id)
              await redeemReward(rewardId, reward.cost)
            }}
          >
            Confirm Redemption
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </Button>
        </div>
      </div>
    ), {
      duration: Infinity,
      position: 'top-center',
    })
  }

  const getRedemptionStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'denied': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rewards...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 md:hidden">Rewards Store</h1>
        <p className="text-gray-600 md:hidden">Spend your points on awesome rewards!</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* My Points & Recent Redemptions */}
        <div className="lg:col-span-1">
          <div className="space-y-6">
            
            {/* Points Balance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  💰 My Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {user.points || 0}
                  </div>
                  <p className="text-sm text-gray-600">Available Points</p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Redemptions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📋 My Redemptions</CardTitle>
              </CardHeader>
              <CardContent>
                {redemptions.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {redemptions.slice(0, 5).map((redemption) => (
                      <div key={redemption.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-medium text-sm">{redemption.reward.name}</h4>
                          <Badge className={`text-xs ${getRedemptionStatusColor(redemption.status)}`}>
                            {redemption.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-600">
                          <span>{redemption.points_spent} points</span>
                          <span>{new Date(redemption.redeemed_at).toLocaleDateString()}</span>
                        </div>
                        {redemption.status === 'pending' && (
                          <p className="text-xs text-yellow-600 mt-1">⏳ Waiting for parent approval</p>
                        )}
                        {redemption.status === 'approved' && (
                          <p className="text-xs text-green-600 mt-1">🎉 Approved! Enjoy your reward!</p>
                        )}
                        {redemption.status === 'denied' && (
                          <p className="text-xs text-red-600 mt-1">❌ Denied - Points refunded</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">No redemptions yet</p>
                    <p className="text-xs text-gray-400 mt-1">Start earning rewards!</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Available Rewards */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>🛍️ Available Rewards</CardTitle>
              <CardDescription>
                {rewards.length} rewards available to redeem
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rewards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {rewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      userPoints={user.points || 0}
                      onRedeem={handleRedeemReward}
                      isParent={false}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎁</div>
                  <p className="text-gray-500 text-lg">No rewards available yet</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Ask your parents to create some rewards for you to earn!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
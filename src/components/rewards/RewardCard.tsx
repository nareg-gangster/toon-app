'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Reward {
  id: string
  name: string
  description: string | null
  cost: number
  category: string | null
  is_active: boolean
}

interface RewardCardProps {
  reward: Reward
  userPoints: number
  onRedeem?: (rewardId: string) => void
  onEdit?: (reward: Reward) => void
  onDelete?: (rewardId: string) => void
  isParent?: boolean
}

export default function RewardCard({ 
  reward, 
  userPoints, 
  onRedeem, 
  onEdit, 
  onDelete,
  isParent = false 
}: RewardCardProps) {
  const canAfford = userPoints >= reward.cost
  
  const getCategoryColor = (category: string | null) => {
    switch (category?.toLowerCase()) {
      case 'treat': return 'bg-pink-100 text-pink-800'
      case 'privilege': return 'bg-blue-100 text-blue-800'
      case 'activity': return 'bg-green-100 text-green-800'
      case 'toy': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className={`${!reward.is_active ? 'opacity-50' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{reward.name}</CardTitle>
            {reward.description && (
              <CardDescription>{reward.description}</CardDescription>
            )}
          </div>
          {reward.category && (
            <Badge className={getCategoryColor(reward.category)}>
              {reward.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-blue-600">{reward.cost}</span>
            <span className="text-sm text-gray-500">points</span>
          </div>

          {!isParent && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Your points:</span>
              <span className={`font-bold ${canAfford ? 'text-green-600' : 'text-red-600'}`}>
                {userPoints}
              </span>
            </div>
          )}

          {isParent ? (
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onEdit?.(reward)}
                className="flex-1"
              >
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onDelete?.(reward.id)}
                className="flex-1"
              >
                Delete
              </Button>
            </div>
          ) : (
            <Button 
              className="w-full" 
              disabled={!canAfford || !reward.is_active}
              onClick={() => onRedeem?.(reward.id)}
            >
              {!canAfford ? `Need ${reward.cost - userPoints} more points` : 'Redeem Reward'}
            </Button>
          )}

          {!reward.is_active && (
            <div className="text-center text-xs text-gray-500">
              Currently unavailable
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
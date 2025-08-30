import { useState, useEffect } from 'react'
import { rewardsService, Reward, RewardRedemption, CreateRewardData } from '@/services/rewardsService'
import toast from 'react-hot-toast'

export const useRewards = (familyId?: string, userId?: string) => {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (familyId) {
      loadRewards()
      loadRedemptions()
    }
  }, [familyId])

  const loadRewards = async () => {
    try {
      if (!familyId) return
      
      const rewardsData = await rewardsService.getRewards(familyId)
      setRewards(rewardsData)
    } catch (error) {
      console.error('Error loading rewards:', error)
      toast.error('Error loading rewards')
    }
  }

  const loadAllRewards = async () => {
    try {
      if (!familyId) return
      
      const rewardsData = await rewardsService.getAllRewards(familyId)
      setRewards(rewardsData)
    } catch (error) {
      console.error('Error loading rewards:', error)
      toast.error('Error loading rewards')
    }
  }

  const loadRedemptions = async () => {
    try {
      if (!familyId) return
      
      let redemptionsData: RewardRedemption[]
      if (userId) {
        // Load user's own redemptions
        redemptionsData = await rewardsService.getMyRedemptions(userId)
      } else {
        // Load all family redemptions (for parents)
        redemptionsData = await rewardsService.getRedemptions(familyId)
      }
      setRedemptions(redemptionsData)
    } catch (error) {
      console.error('Error loading redemptions:', error)
      toast.error('Error loading redemptions')
    } finally {
      setLoading(false)
    }
  }

  const createReward = async (rewardData: CreateRewardData) => {
    try {
      if (!familyId) return

      const newReward = await rewardsService.createReward(rewardData, familyId)
      setRewards(prev => [newReward, ...prev])
      toast.success('Reward created successfully! 🎁')
      return newReward
    } catch (error) {
      console.error('Error creating reward:', error)
      toast.error('Error creating reward')
      throw error
    }
  }

  const updateReward = async (rewardId: string, rewardData: Partial<CreateRewardData>) => {
    try {
      await rewardsService.updateReward(rewardId, rewardData)
      setRewards(prev => prev.map(reward => 
        reward.id === rewardId 
          ? { ...reward, ...rewardData }
          : reward
      ))
      toast.success('Reward updated successfully! ✏️')
    } catch (error) {
      console.error('Error updating reward:', error)
      toast.error('Error updating reward')
      throw error
    }
  }

  const deleteReward = async (rewardId: string) => {
    try {
      await rewardsService.deleteReward(rewardId)
      setRewards(prev => prev.filter(reward => reward.id !== rewardId))
      toast.success('Reward deleted successfully')
    } catch (error) {
      console.error('Error deleting reward:', error)
      toast.error('Error deleting reward')
    }
  }

  const redeemReward = async (rewardId: string, pointsCost: number) => {
    try {
      if (!userId) return

      await rewardsService.redeemReward(userId, rewardId, pointsCost)
      toast.success('Reward redeemed! Waiting for parent approval... 🎉')
      
      // Refresh redemptions
      loadRedemptions()
    } catch (error: any) {
      console.error('Error redeeming reward:', error)
      if (error.message === 'Insufficient points') {
        toast.error('Not enough points to redeem this reward')
      } else {
        toast.error('Error redeeming reward')
      }
    }
  }

  const approveRedemption = async (redemptionId: string) => {
    try {
      await rewardsService.approveRedemption(redemptionId)
      setRedemptions(prev => prev.map(redemption => 
        redemption.id === redemptionId 
          ? { ...redemption, status: 'approved' }
          : redemption
      ))
      toast.success('Redemption approved! 🎉')
    } catch (error) {
      console.error('Error approving redemption:', error)
      toast.error('Error approving redemption')
    }
  }

  const denyRedemption = async (redemptionId: string, userId: string, pointsToRefund: number) => {
    try {
      await rewardsService.denyRedemption(redemptionId, userId, pointsToRefund)
      setRedemptions(prev => prev.map(redemption => 
        redemption.id === redemptionId 
          ? { ...redemption, status: 'denied' }
          : redemption
      ))
      toast.success('Redemption denied and points refunded')
    } catch (error) {
      console.error('Error denying redemption:', error)
      toast.error('Error denying redemption')
    }
  }

  return {
    rewards,
    redemptions,
    loading,
    createReward,
    updateReward,
    deleteReward,
    redeemReward,
    approveRedemption,
    denyRedemption,
    refetchRewards: loadRewards,
    refetchAllRewards: loadAllRewards,
    refetchRedemptions: loadRedemptions
  }
}
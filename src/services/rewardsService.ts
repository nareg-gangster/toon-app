import { supabase } from '@/lib/supabase'

export interface Reward {
  id: string
  name: string
  description: string | null
  cost: number
  category: string | null
  is_active: boolean
  family_id: string
  created_at: string
}

export interface RewardRedemption {
  id: string
  user_id: string
  reward_id: string
  points_spent: number
  status: 'pending' | 'approved' | 'denied'
  redeemed_at: string
  reward: {
    name: string
    cost: number
  }
  users: {
    name: string
  }
}

export interface CreateRewardData {
  name: string
  description?: string
  cost: number
  category: string
}

export const rewardsService = {
  async getRewards(familyId: string): Promise<Reward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('family_id', familyId)
      .eq('is_active', true)
      .order('cost', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getAllRewards(familyId: string): Promise<Reward[]> {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async createReward(rewardData: CreateRewardData, familyId: string): Promise<Reward> {
    const { data, error } = await supabase
      .from('rewards')
      .insert({
        name: rewardData.name,
        description: rewardData.description || null,
        cost: rewardData.cost,
        category: rewardData.category,
        family_id: familyId,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateReward(rewardId: string, rewardData: Partial<CreateRewardData>): Promise<void> {
    const { error } = await supabase
      .from('rewards')
      .update(rewardData)
      .eq('id', rewardId)

    if (error) throw error
  },

  async deleteReward(rewardId: string): Promise<void> {
    const { error } = await supabase
      .from('rewards')
      .update({ is_active: false })
      .eq('id', rewardId)

    if (error) throw error
  },

  async redeemReward(userId: string, rewardId: string, pointsCost: number): Promise<void> {
    // First, check if user has enough points
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single()

    if (userError) throw userError
    
    if (userData.points < pointsCost) {
      throw new Error('Insufficient points')
    }

    // Create redemption record
    const { error: redemptionError } = await supabase
      .from('reward_redemptions')
      .insert({
        user_id: userId,
        reward_id: rewardId,
        points_spent: pointsCost,
        status: 'pending'
      })

    if (redemptionError) throw redemptionError

    // Deduct points from user
    const { error: pointsError } = await supabase
      .from('users')
      .update({ 
        points: userData.points - pointsCost
      })
      .eq('id', userId)

    if (pointsError) throw pointsError
  },

  async getRedemptions(familyId: string): Promise<RewardRedemption[]> {
    const { data, error } = await supabase
      .from('reward_redemptions')
      .select(`
        *,
        reward:rewards(name, cost),
        users(name)
      `)
      .eq('reward.family_id', familyId)
      .order('redeemed_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getMyRedemptions(userId: string): Promise<RewardRedemption[]> {
    const { data, error } = await supabase
      .from('reward_redemptions')
      .select(`
        *,
        reward:rewards(name, cost)
      `)
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async approveRedemption(redemptionId: string): Promise<void> {
    const { error } = await supabase
      .from('reward_redemptions')
      .update({ status: 'approved' })
      .eq('id', redemptionId)

    if (error) throw error
  },

  async denyRedemption(redemptionId: string, userId: string, pointsToRefund: number): Promise<void> {
    // Update redemption status
    const { error: redemptionError } = await supabase
      .from('reward_redemptions')
      .update({ status: 'denied' })
      .eq('id', redemptionId)

    if (redemptionError) throw redemptionError

    // Refund points to user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    const { error: pointsError } = await supabase
      .from('users')
      .update({ 
        points: (userData.points || 0) + pointsToRefund
      })
      .eq('id', userId)

    if (pointsError) throw pointsError
  }
}
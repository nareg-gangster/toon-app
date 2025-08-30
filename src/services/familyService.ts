import { supabase } from '@/lib/supabase'
import { User, CreateChildData } from '@/types'

export const familyService = {
  async getFamilyMembers(familyId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('family_id', familyId)
      .order('role', { ascending: false }) // Parents first

    if (error) throw error
    return data || []
  },

  async getChildren(familyId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('family_id', familyId)
      .eq('role', 'child')
      .order('name')

    if (error) throw error
    return data || []
  },

  async createChild(childData: CreateChildData, familyId: string): Promise<{ user: User; password: string }> {
    const tempPassword = `${childData.name.toLowerCase().replace(' ', '')}123`

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: childData.email,
      password: tempPassword,
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('Failed to create auth user')

    // Create user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: childData.email,
        name: childData.name,
        role: 'child',
        family_id: familyId,
        points: 0
      })
      .select()
      .single()

    if (userError) throw userError

    return {
      user: userData,
      password: tempPassword
    }
  },

  async deleteChild(childId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', childId)

    if (error) throw error
  }
}
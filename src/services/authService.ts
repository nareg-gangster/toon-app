import { supabase } from '@/lib/supabase'
import { User } from '@/types'

export const authService = {
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return null

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error || !userData) {
        console.error('User data error:', error)
        return null
      }

      return userData
    } catch (error) {
      console.error('Auth error:', error)
      return null
    }
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error
    return data
  }
}
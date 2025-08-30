import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/authService'
import { User } from '@/types'
import toast from 'react-hot-toast'
import { familyMembersService } from '@/services/familyMembersService'


export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      console.log('🔍 Loading current user...')
      const userData = await authService.getCurrentUser()
      console.log('👤 Current user result:', userData)
      setUser(userData)
      
      if (!userData) {
        console.log('❌ No user found, should redirect to login')
      }
    } catch (error) {
      console.error('🚨 Error loading user:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && !user.password_changed) {
      // Mark invitation as accepted on first login
      familyMembersService.acceptInvitationOnLogin(user.id).catch(console.error)
    }
  }, [user])

  const signOut = async () => {
    try {
      await authService.signOut()
      setUser(null)
      toast.success('Signed out successfully')
      router.push('/')
    } catch (error) {
      toast.error('Error signing out')
    }
  }

  const requireAuth = (requiredRole?: 'parent' | 'child') => {
    console.log('🔐 Checking auth requirement:', { user: user?.role, required: requiredRole, loading })
    
    // Don't redirect if still loading
    if (loading) {
      console.log('⏳ Still loading, not redirecting')
      return false
    }
    
    if (!user) {
      console.log('❌ No user, redirecting to signin')
      router.push('/auth/signin')
      return false
    }
  
    if (requiredRole && user.role !== requiredRole) {
      console.log('🔄 Wrong role, redirecting to correct dashboard')
      const correctPath = user.role === 'parent' ? '/dashboard/parent' : '/dashboard/child'
      router.push(correctPath)
      return false
    }
  
    console.log('✅ Auth check passed')
    return true
  }

  return {
    user,
    loading,
    signOut,
    requireAuth,
    refetchUser: loadUser
  }
}
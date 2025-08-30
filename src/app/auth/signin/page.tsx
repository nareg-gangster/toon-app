'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'

export default function SignInPage() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const router = useRouter()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
  
    try {
      const loadingToast = toast.loading('Signing you in...')
  
      console.log('🔐 Attempting sign in for:', formData.email)
  
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })
  
      if (error) {
        console.error('❌ Auth sign in error:', error)
        toast.dismiss(loadingToast)
        toast.error(`Sign in failed: ${error.message}`)
        setLoading(false)
        return
      }
  
      console.log('✅ Auth successful, user:', data.user?.id, data.user?.email)
  
      if (data.user) {
        // Get user's role to redirect appropriately
        console.log('🔍 Looking up user profile...')
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, name, family_id, id')
          .eq('id', data.user.id)
          .single()
  
        console.log('👤 User profile result:', { userData, userError })
  
        toast.dismiss(loadingToast)
  
        if (userError) {
          console.error('❌ User profile error:', userError)
          toast.error(`Profile error: ${userError.message}`)
          setLoading(false)
          return
        }
  
        if (userData) {
          console.log('🎉 Profile found:', userData)
          toast.success(`Welcome back, ${userData.name}! 👋`)
          
          // Add small delay then redirect based on role
          setTimeout(() => {
            console.log('🚀 Redirecting to:', userData.role === 'parent' ? '/dashboard/parent' : '/dashboard/child')
            if (userData.role === 'parent') {
              router.push('/dashboard/parent')
            } else {
              router.push('/dashboard/child')
            }
          }, 1000)
        } else {
          console.error('❌ No user profile found')
          toast.error('User profile not found')
          setLoading(false)
        }
      }
  
    } catch (error: any) {
      console.error('💥 Unexpected sign in error:', error)
      toast.error(`Something went wrong: ${error.message || 'Please try again'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <div className="max-w-md w-full">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in to your family account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Your password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link href="/auth/register" className="text-blue-600 hover:underline">
                  Create family account
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
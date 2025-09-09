'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'

export default function RegisterPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    familyName: '',
    parentName: '',
    parentEmail: '',
    password: '',
    confirmPassword: ''
  })

  useEffect(() => {
    // Redirect authenticated users to their dashboard
    if (!authLoading && user) {
      if (user.role === 'parent') {
        router.push('/dashboard/parent')
      } else if (user.role === 'child') {
        router.push('/dashboard/child')
      }
    }
  }, [user, authLoading, router])

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render if user is authenticated (they'll be redirected)  
  if (user) return null

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validation
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match!')
        setLoading(false)
        return
      }

      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters!')
        setLoading(false)
        return
      }

      const loadingToast = toast.loading('Creating your family account...')

      // Step 1: Create Supabase auth user first
      console.log('Creating auth user...')
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.parentEmail,
        password: formData.password,
      })

      if (authError) {
        console.error('Auth creation failed:', authError)
        toast.dismiss(loadingToast)
        toast.error(`Registration failed: ${authError.message}`)
        setLoading(false)
        return
      }

      if (!authData.user) {
        toast.dismiss(loadingToast)
        toast.error('Failed to create user account')
        setLoading(false)
        return
      }

      console.log('Auth user created:', authData.user.id)

      // Step 2: Create family (now that we're authenticated)
      console.log('Creating family record...')
      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .insert([{
          name: formData.familyName
        }])
        .select()
        .single()

      if (familyError) {
        console.error('Family creation failed:', familyError)
        toast.dismiss(loadingToast)
        toast.error(`Family creation failed: ${familyError.message || 'Please try again'}`)
        setLoading(false)
        return
      }

      console.log('Family created:', familyData)

      // Step 3: Create user record
      console.log('Creating user record...')
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert([{
          id: authData.user.id,
          email: formData.parentEmail,
          name: formData.parentName,
          role: 'parent',
          family_id: familyData.id,
          points: 0,
          password_changed: true // Self-registered users have already chosen their password
        }])
        .select()
        .single()

      if (userError) {
        console.error('User record creation failed:', userError)
        toast.dismiss(loadingToast)
        toast.error(`Profile creation failed: ${userError.message || 'Please try again'}`)
        setLoading(false)
        return
      }

      console.log('User record created:', userData)

      toast.dismiss(loadingToast)
      toast.success('🎉 Family created successfully!')
      
      // Clear form
      setFormData({
        familyName: '',
        parentName: '',
        parentEmail: '',
        password: '',
        confirmPassword: ''
      })

      // Redirect after delay
      setTimeout(() => {
        router.push('/auth/signin')
      }, 2000)

    } catch (error: any) {
      console.error('Unexpected registration error:', error)
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
            <CardTitle className="text-2xl text-center">Create Your Family</CardTitle>
            <CardDescription className="text-center">
              Set up your family account to start organizing tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateFamily} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="familyName">Family Name</Label>
                <Input
                  id="familyName"
                  placeholder="The Smith Family"
                  value={formData.familyName}
                  onChange={(e) => setFormData({...formData, familyName: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentName">Your Name (Parent)</Label>
                <Input
                  id="parentName"
                  placeholder="John Smith"
                  value={formData.parentName}
                  onChange={(e) => setFormData({...formData, parentName: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentEmail">Your Email</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.parentEmail}
                  onChange={(e) => setFormData({...formData, parentEmail: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat your password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Family...' : 'Create Family Account'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/auth/signin" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
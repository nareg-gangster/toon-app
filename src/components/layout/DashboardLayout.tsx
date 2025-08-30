'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Toaster } from 'react-hot-toast'
import GlobalHeader from './GlobalHeader'
import BottomNavigation from './BottomNavigation'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      
      {/* Global Header - Desktop only */}
      <GlobalHeader user={user} onSignOut={signOut} />
      
      {/* Main Content */}
      <main className="pb-16 md:pb-0">
        {children}
      </main>
      
      {/* Bottom Navigation - Mobile only */}
      <BottomNavigation user={user} />
    </div>
  )
}
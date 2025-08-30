'use client'

import { Button } from '@/components/ui/button'
import { User } from '@/types'

interface GlobalHeaderProps {
  user: User | null
  onSignOut: () => void
}

export default function GlobalHeader({ user, onSignOut }: GlobalHeaderProps) {
  // Show header on mobile for children (they need sign out), hide on mobile for parents (they have bottom nav)
  const headerClasses = user?.role === 'child' 
    ? "flex bg-white shadow-sm border-b" // Always show for children
    : "hidden md:flex bg-white shadow-sm border-b" // Hide on mobile for parents

  return (
    <header className={headerClasses}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-blue-600">Family Tasks</h1>
            {user && (
              <div className="hidden sm:block text-sm text-gray-600">
                <span className="capitalize">{user.role}</span> Dashboard
              </div>
            )}
          </div>
          
          {user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-600 hidden sm:block">{user.email}</p>
                </div>
                {user.role === 'child' && (
                  <div className="text-center bg-blue-50 rounded-lg px-3 py-1">
                    <p className="text-lg font-bold text-blue-600">{user.points}</p>
                    <p className="text-xs text-blue-500">points</p>
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={onSignOut} size="sm">
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
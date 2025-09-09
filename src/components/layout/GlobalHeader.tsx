'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { User } from '@/types'
import { cn } from '@/lib/utils'
import { negotiationService } from '@/services/negotiationService'
import { useRewards } from '@/hooks/useRewards'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { 
  Home, 
  CheckSquare, 
  Users, 
  Gift, 
  User as UserIcon,
  Handshake
} from 'lucide-react'

interface GlobalHeaderProps {
  user: User | null
  onSignOut: () => void
}

export default function GlobalHeader({ user, onSignOut }: GlobalHeaderProps) {
  // Only show on desktop - mobile has local headers and bottom navigation
  const headerClasses = "hidden md:flex bg-white shadow-sm border-b"
  const pathname = usePathname()
  const [pendingNegotiations, setPendingNegotiations] = useState(0)
  
  // For parents: track pending reward redemptions
  const { redemptions } = useRewards(user?.family_id)
  const pendingRedemptions = user?.role === 'parent' 
    ? redemptions.filter(r => r.status === 'pending').length 
    : 0

  useEffect(() => {
    if (user && user.role === 'child') {
      loadNegotiationStats()
      
      // Set up polling for real-time updates
      const interval = setInterval(loadNegotiationStats, 30000) // Check every 30 seconds
      
      return () => clearInterval(interval)
    }
  }, [user])

  const loadNegotiationStats = async () => {
    if (!user) return
    
    try {
      const stats = await negotiationService.getNegotiationStats(user.id)
      setPendingNegotiations(stats.pending_received)
    } catch (error) {
      console.error('Error loading negotiation stats:', error)
    }
  }

  const navItems = user?.role === 'parent' ? [
    { href: '/dashboard/parent', icon: Home, label: 'Home' },
    { href: '/dashboard/parent/tasks', icon: CheckSquare, label: 'Tasks' },
    { href: '/dashboard/parent/children', icon: Users, label: 'Family' },
    { href: '/dashboard/parent/rewards', icon: Gift, label: 'Rewards', badge: pendingRedemptions > 0 ? pendingRedemptions : undefined },
    { href: '/dashboard/parent/profile', icon: UserIcon, label: 'Profile' },
  ] : [
    { href: '/dashboard/child', icon: Home, label: 'Home' },
    { href: '/dashboard/child/tasks', icon: CheckSquare, label: 'Tasks' },
    { href: '/dashboard/child/negotiations', icon: Handshake, label: 'Negotiate', badge: pendingNegotiations > 0 ? pendingNegotiations : undefined },
    { href: '/dashboard/child/rewards', icon: Gift, label: 'Rewards' },
    { href: '/dashboard/child/profile', icon: UserIcon, label: 'Profile' },
  ]

  return (
    <header className={headerClasses}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-8">
            <Link href={user?.role === 'parent' ? '/dashboard/parent' : '/dashboard/child'}>
              <h1 className="text-2xl font-bold text-blue-600 hover:text-blue-700 cursor-pointer">
                Family Tasks
              </h1>
            </Link>
            
            {user && (
              <nav className="flex items-center space-x-6">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  
                  return (
                    <Link 
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                        isActive 
                          ? "bg-blue-100 text-blue-700" 
                          : "text-gray-600 hover:text-blue-600 hover:bg-gray-50"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                      {item.badge && item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs min-w-5 h-5 flex items-center justify-center font-bold shadow-lg">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </nav>
            )}
          </div>
          
          {user && (
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <div className="flex items-center space-x-3">
                {user.role === 'child' && (
                  <div className="text-center bg-blue-50 rounded-lg px-3 py-1">
                    <p className="text-lg font-bold text-blue-600">{user.points}</p>
                    <p className="text-xs text-blue-500">points</p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-600 hidden lg:block">{user.email}</p>
                </div>
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
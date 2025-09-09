'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { User } from '@/types'
import { useEffect, useState } from 'react'
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

interface BottomNavigationProps {
  user: User | null
}

interface NavItemProps {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  isActive: boolean
  badge?: number
}

function NavItem({ href, icon: Icon, label, isActive, badge }: NavItemProps) {
  return (
    <Link href={href} className="flex-1">
      <div className={cn(
        "flex flex-col items-center justify-center py-3 px-2 transition-all duration-200 relative group",
        isActive 
          ? "text-blue-600 bg-blue-50 rounded-xl mx-1" 
          : "text-gray-500 hover:text-blue-600 hover:bg-gray-50 rounded-xl mx-1"
      )}>
        <div className={cn(
          "p-1.5 rounded-lg transition-all duration-200",
          isActive 
            ? "bg-blue-100" 
            : "group-hover:bg-blue-50"
        )}>
          <Icon className={cn(
            "w-5 h-5 transition-all duration-200",
            isActive 
              ? "text-blue-600" 
              : "text-gray-500 group-hover:text-blue-600"
          )} />
        </div>
        <span className={cn(
          "text-xs font-medium mt-1 transition-colors duration-200",
          isActive 
            ? "text-blue-600" 
            : "text-gray-500 group-hover:text-blue-600"
        )}>
          {label}
        </span>
        {badge && badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full text-xs min-w-5 h-5 flex items-center justify-center font-bold shadow-lg animate-pulse">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
    </Link>
  )
}

export default function BottomNavigation({ user }: BottomNavigationProps) {
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
  
  if (!user) return null

  const isParent = user.role === 'parent'

  const navItems = isParent ? [
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-100 z-50 shadow-lg">
      <div className="flex py-2">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={pathname === item.href}
            badge={item.badge}
          />
        ))}
      </div>
      
      {/* Notification Bell - Mobile */}
      <div className="absolute -top-12 left-4">
        <NotificationBell />
      </div>
      
      {/* Points display for children */}
      {!isParent && (
        <div className="absolute -top-14 right-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full px-4 py-2 text-sm font-bold shadow-lg">
          <span className="text-blue-100">💎</span> {user.points || 0} pts
        </div>
      )}
    </nav>
  )
}
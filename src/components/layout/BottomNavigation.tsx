'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { User } from '@/types'

interface BottomNavigationProps {
  user: User | null
}

interface NavItemProps {
  href: string
  icon: string
  label: string
  isActive: boolean
}

function NavItem({ href, icon, label, isActive }: NavItemProps) {
  return (
    <Link href={href} className="flex-1">
      <div className={cn(
        "flex flex-col items-center justify-center py-2 px-1 transition-colors",
        isActive 
          ? "text-blue-600 bg-blue-50" 
          : "text-gray-600 hover:text-blue-600"
      )}>
        <span className="text-xl mb-1">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
    </Link>
  )
}

export default function BottomNavigation({ user }: BottomNavigationProps) {
  const pathname = usePathname()
  
  if (!user) return null

  const isParent = user.role === 'parent'

  const navItems = isParent ? [
    { href: '/dashboard/parent', icon: '🏠', label: 'Home' },
    { href: '/dashboard/parent/tasks', icon: '📝', label: 'Tasks' },
    { href: '/dashboard/parent/children', icon: '👨‍👩‍👧‍👦', label: 'Family' },
    { href: '/dashboard/parent/rewards', icon: '🎁', label: 'Rewards' },
    { href: '/dashboard/parent/profile', icon: '👤', label: 'Profile' }, // Updated
  ] : [
    { href: '/dashboard/child', icon: '🏠', label: 'Home' },
    { href: '/dashboard/child/tasks', icon: '📝', label: 'Tasks' },
    { href: '/dashboard/child/rewards', icon: '🎁', label: 'Rewards' },
    { href: '/dashboard/child/achievements', icon: '🏆', label: 'Stats' },
    { href: '/dashboard/child/profile', icon: '👤', label: 'Profile' }, // Updated
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={pathname === item.href}
          />
        ))}
      </div>
      
      {/* Points display for children */}
      {!isParent && (
        <div className="absolute -top-12 right-4 bg-blue-600 text-white rounded-full px-3 py-1 text-sm font-bold">
          {user.points || 0} pts
        </div>
      )}
    </nav>
  )
}
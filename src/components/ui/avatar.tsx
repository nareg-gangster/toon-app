'use client'

import React from 'react'
import { User } from 'lucide-react'

interface AvatarProps {
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fallbackName?: string
  className?: string
}

export function Avatar({ src, alt, size = 'md', fallbackName, className }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-xl'
  }

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32
  }

  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  return (
    <div className={`${sizeClasses[size]} ${className || ''} relative rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-200 border-2 border-white shadow-md flex items-center justify-center`}>
      {src ? (
        <img 
          src={src} 
          alt={alt || 'Profile picture'} 
          className="w-full h-full object-cover"
          onError={(e) => {
            // Hide broken image and show fallback
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : fallbackName ? (
        <span className="font-semibold text-gray-700">
          {getInitials(fallbackName)}
        </span>
      ) : (
        <User size={iconSizes[size]} className="text-gray-500" />
      )}
    </div>
  )
}
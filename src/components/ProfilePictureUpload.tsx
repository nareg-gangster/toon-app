'use client'

import React, { useState, useRef } from 'react'
import { Camera, Upload, X, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface ProfilePictureUploadProps {
  userId: string
  currentAvatarUrl?: string | null
  userName: string
  onUpdate: (newAvatarUrl: string | null) => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function ProfilePictureUpload({ 
  userId, 
  currentAvatarUrl, 
  userName, 
  onUpdate,
  size = 'lg'
}: ProfilePictureUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    setUploading(true)

    try {
      // Delete old avatar if exists
      if (currentAvatarUrl) {
        const oldFileName = currentAvatarUrl.split('/').pop()
        if (oldFileName) {
          await supabase.storage
            .from('avatars')
            .remove([`${userId}/${oldFileName}`])
        }
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${userId}/${fileName}`

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update user record
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      onUpdate(publicUrl)
      setPreviewUrl(null)
      toast.success('Profile picture updated!')
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error('Failed to upload image: ' + error.message)
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!currentAvatarUrl) return

    setUploading(true)

    try {
      // Delete from storage
      const fileName = currentAvatarUrl.split('/').pop()
      if (fileName) {
        await supabase.storage
          .from('avatars')
          .remove([`${userId}/${fileName}`])
      }

      // Update user record
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: null })
        .eq('id', userId)

      if (error) throw error

      onUpdate(null)
      toast.success('Profile picture removed')
    } catch (error: any) {
      console.error('Remove error:', error)
      toast.error('Failed to remove image: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar 
          src={previewUrl || currentAvatarUrl} 
          alt={userName}
          size={size}
          fallbackName={userName}
        />
        
        {uploading && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {currentAvatarUrl ? (
            <>
              <Camera className="w-4 h-4 mr-2" />
              Change
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </>
          )}
        </Button>

        {currentAvatarUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={uploading}
          >
            <X className="w-4 h-4 mr-2" />
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
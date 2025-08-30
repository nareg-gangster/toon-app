'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface PhotoUploadProps {
  onPhotoSelected: (file: File) => void
  onPhotoRemoved: () => void
  currentPhoto?: File | string | null
  disabled?: boolean
}

export default function PhotoUpload({ 
  onPhotoSelected, 
  onPhotoRemoved, 
  currentPhoto, 
  disabled 
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Pass file to parent component
    onPhotoSelected(file)
  }

  const handleRemovePhoto = () => {
    setPreview(null)
    onPhotoRemoved()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  // Determine image source - fix the empty string issue
  const getImageSrc = () => {
    if (preview) return preview
    if (typeof currentPhoto === 'string' && currentPhoto) return currentPhoto
    return null
  }

  const imageSrc = getImageSrc()

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {imageSrc ? (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <img
                src={imageSrc}
                alt="Task completion photo"
                className="w-full h-48 object-cover rounded-lg"
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2"
                onClick={handleRemovePhoto}
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2 border-gray-300 hover:border-gray-400 transition-colors">
          <CardContent className="p-6">
            <div className="text-center">
              <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                Add a photo to show your completed task
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={triggerFileInput}
                disabled={disabled}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Photo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
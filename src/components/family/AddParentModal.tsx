'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Users } from 'lucide-react'

interface AddParentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string; email: string }) => Promise<void>
  submitting?: boolean
}

export default function AddParentModal({
  isOpen,
  onClose,
  onSubmit,
  submitting = false
}: AddParentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await onSubmit(formData)
      setFormData({ name: '', email: '' })
      onClose()
    } catch (error) {
      // Error handling done in parent
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Add Parent to Family
          </CardTitle>
          <CardDescription>
            Add another parent with full family management permissions
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-2">
              <Label htmlFor="parentName">Parent Name</Label>
              <Input
                id="parentName"
                placeholder="e.g., Sarah Johnson"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentEmail">Email Address</Label>
              <Input
                id="parentEmail"
                type="email"
                placeholder="sarah@example.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                disabled={submitting}
              />
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-2">What happens next:</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Parent account will be created with temporary password</li>
                <li>• They can log in and set their own password</li>
                <li>• Full parent permissions (create tasks, rewards, etc.)</li>
                <li>• Equal access to family management</li>
              </ul>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? 'Adding Parent...' : 'Add Parent'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}
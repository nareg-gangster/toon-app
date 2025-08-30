'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Gift } from 'lucide-react'

interface RewardModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (rewardData: any) => Promise<void>
  editingReward?: any
}

export default function RewardModal({ isOpen, onClose, onSubmit, editingReward }: RewardModalProps) {
  const [formData, setFormData] = useState({
    name: editingReward?.name || '',
    description: editingReward?.description || '',
    cost: editingReward?.cost || 10,
    category: editingReward?.category || 'treat'
  })
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      await onSubmit({
        ...formData,
        cost: parseInt(formData.cost.toString())
      })
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        cost: 10,
        category: 'treat'
      })
      onClose()
    } catch (error) {
      console.error('Error saving reward:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Gift className="w-5 h-5 mr-2" />
            {editingReward ? 'Edit Reward' : 'Create New Reward'}
          </CardTitle>
          <CardDescription>
            {editingReward ? 'Update reward details' : 'Create a reward for your children to earn'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-2">
              <Label htmlFor="name">Reward Name</Label>
              <Input
                id="name"
                placeholder="Extra screen time"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="30 minutes extra iPad time"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                disabled={saving}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Point Cost</Label>
                <Input
                  id="cost"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.cost}
                  onChange={(e) => setFormData({...formData, cost: parseInt(e.target.value) || 10})}
                  required
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({...formData, category: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treat">🍭 Treat</SelectItem>
                    <SelectItem value="privilege">⭐ Privilege</SelectItem>
                    <SelectItem value="activity">🎯 Activity</SelectItem>
                    <SelectItem value="toy">🧸 Toy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Saving...' : editingReward ? 'Update Reward' : 'Create Reward'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}
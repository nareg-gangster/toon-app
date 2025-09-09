'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HandHeart, MessageSquare, X, Star } from 'lucide-react'
import { negotiationService } from '@/services/negotiationService'
import toast from 'react-hot-toast'
import { CreateSiblingTransferData, CreateParentNegotiationData } from '@/types'

interface StartNegotiationModalProps {
  isOpen: boolean
  onClose: () => void
  task: {
    id: string
    title: string
    points: number
    due_date?: string
    description?: string
  }
  onSuccess?: () => void
}

export default function StartNegotiationModal({
  isOpen,
  onClose,
  task,
  onSuccess
}: StartNegotiationModalProps) {
  const [activeTab, setActiveTab] = useState('sibling_transfer')
  const [loading, setLoading] = useState(false)
  const [siblings, setSiblings] = useState<{ id: string; name: string; points: number }[]>([])
  const [parents, setParents] = useState<{ id: string; name: string }[]>([])

  // Sibling Transfer State
  const [transferData, setTransferData] = useState<Partial<CreateSiblingTransferData>>({
    task_id: task.id,
    recipient_id: '',
    points_offered_to_recipient: Math.floor(task.points / 2),
    points_kept_by_initiator: Math.ceil(task.points / 2),
    expires_in_hours: 24,
    offer_message: ''
  })

  // Parent Negotiation State
  const [parentData, setParentData] = useState<Partial<CreateParentNegotiationData>>({
    task_id: task.id,
    recipient_id: '',
    requested_points: task.points,
    requested_due_date: task.due_date || '',
    requested_description: task.description || '',
    offer_message: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadSiblings()
      loadParents()
    }
  }, [isOpen])

  useEffect(() => {
    // Update task_id when task changes
    setTransferData(prev => ({ ...prev, task_id: task.id }))
    setParentData(prev => ({ ...prev, task_id: task.id }))
  }, [task.id])

  const loadSiblings = async () => {
    try {
      const siblingList = await negotiationService.getSiblingsForTransfer(task.id)
      setSiblings(siblingList)
    } catch (error) {
      console.error('Error loading siblings:', error)
    }
  }

  const loadParents = async () => {
    try {
      const parentList = await negotiationService.getParentsForNegotiation()
      setParents(parentList)
    } catch (error) {
      console.error('Error loading parents:', error)
    }
  }

  const handleSiblingTransfer = async () => {
    if (!transferData.recipient_id) {
      toast.error('Please select a sibling')
      return
    }

    if ((transferData.points_offered_to_recipient || 0) + (transferData.points_kept_by_initiator || 0) !== task.points) {
      toast.error('Point split must equal total task points')
      return
    }

    try {
      setLoading(true)
      await negotiationService.createSiblingTransferOffer(transferData as CreateSiblingTransferData)
      toast.success('Transfer offer sent! 🚀')
      onSuccess?.()
      onClose()
    } catch (error: any) {
      console.error('Error creating transfer offer:', error)
      toast.error(error.message || 'Error creating transfer offer')
    } finally {
      setLoading(false)
    }
  }

  const handleParentNegotiation = async () => {
    if (!parentData.recipient_id) {
      toast.error('Please select a parent')
      return
    }

    try {
      setLoading(true)
      await negotiationService.createParentNegotiationRequest(parentData as CreateParentNegotiationData)
      toast.success('Negotiation request sent! 📝')
      onSuccess?.()
      onClose()
    } catch (error: any) {
      console.error('Error creating parent negotiation:', error)
      toast.error(error.message || 'Error creating negotiation request')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setTransferData({
      task_id: task.id,
      recipient_id: '',
      points_offered_to_recipient: Math.floor(task.points / 2),
      points_kept_by_initiator: Math.ceil(task.points / 2),
      expires_in_hours: 24,
      offer_message: ''
    })
    setParentData({
      task_id: task.id,
      recipient_id: '',
      requested_points: task.points,
      requested_due_date: task.due_date || '',
      requested_description: task.description || '',
      offer_message: ''
    })
    setActiveTab('sibling_transfer')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" style={{paddingRight: 'calc(100vw - 100%)'}}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{width: '512px', maxWidth: 'calc(100vw - 32px)'}}>
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-semibold">Start Negotiation</h2>
            <p className="text-sm text-gray-600 mt-1">for: {task.title}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <h3 className="font-medium text-blue-900">{task.title}</h3>
                <p className="text-sm text-blue-700 mt-1">Total Points: {task.points}</p>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-bold text-blue-900">{task.points}</span>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sibling_transfer" className="flex items-center space-x-2">
                <HandHeart className="w-4 h-4" />
                <span>Transfer to Sibling</span>
              </TabsTrigger>
              <TabsTrigger value="parent_negotiation" className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4" />
                <span>Negotiate with Parent</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sibling_transfer" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <HandHeart className="w-5 h-5 text-pink-500" />
                    <span>Transfer Task to Sibling</span>
                  </CardTitle>
                  <CardDescription>
                    Offer to transfer this task to a sibling and split the points
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {siblings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <HandHeart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p>No siblings available for transfer</p>
                      <p className="text-sm text-gray-400 mt-1">You need siblings in your family to make transfer offers</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label>Select Sibling</Label>
                        <Select 
                          value={transferData.recipient_id} 
                          onValueChange={(value) => setTransferData(prev => ({ ...prev, recipient_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a sibling" />
                          </SelectTrigger>
                          <SelectContent>
                            {siblings.map((sibling) => (
                              <SelectItem key={sibling.id} value={sibling.id}>
                                {sibling.name} ({sibling.points} points)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Point Split</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="pointsToSibling">Points to Sibling</Label>
                            <Input
                              id="pointsToSibling"
                              type="number"
                              value={transferData.points_offered_to_recipient || 0}
                              onChange={(e) => {
                                const points = parseInt(e.target.value) || 0
                                setTransferData(prev => ({ 
                                  ...prev, 
                                  points_offered_to_recipient: points,
                                  points_kept_by_initiator: task.points - points
                                }))
                              }}
                              min="0"
                              max={task.points}
                            />
                          </div>
                          <div>
                            <Label htmlFor="pointsToMe">Points You Keep</Label>
                            <Input
                              id="pointsToMe"
                              type="number"
                              value={transferData.points_kept_by_initiator || 0}
                              onChange={(e) => {
                                const points = parseInt(e.target.value) || 0
                                setTransferData(prev => ({ 
                                  ...prev, 
                                  points_kept_by_initiator: points,
                                  points_offered_to_recipient: task.points - points
                                }))
                              }}
                              min="0"
                              max={task.points}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 mt-2">
                          Total: {(transferData.points_offered_to_recipient || 0) + (transferData.points_kept_by_initiator || 0)} of {task.points} points
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Label htmlFor="expiresIn">Expires in:</Label>
                        <div className="w-auto">
                          <Select 
                            value={transferData.expires_in_hours?.toString()} 
                            onValueChange={(value) => setTransferData(prev => ({ ...prev, expires_in_hours: parseInt(value) }))}
                          >
                            <SelectTrigger className="w-auto min-w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 hour</SelectItem>
                              <SelectItem value="6">6 hours</SelectItem>
                              <SelectItem value="12">12 hours</SelectItem>
                              <SelectItem value="24">24 hours</SelectItem>
                              <SelectItem value="48">48 hours</SelectItem>
                              <SelectItem value="72">72 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="transferMessage">Message (optional)</Label>
                        <Textarea
                          id="transferMessage"
                          placeholder="Add a message to explain your offer..."
                          value={transferData.offer_message}
                          onChange={(e) => setTransferData(prev => ({ ...prev, offer_message: e.target.value }))}
                          rows={2}
                        />
                      </div>

                      <Button 
                        onClick={handleSiblingTransfer} 
                        disabled={loading || !transferData.recipient_id}
                        className="w-full"
                      >
                        {loading ? 'Sending Offer...' : 'Send Transfer Offer'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="parent_negotiation" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                    <span>Negotiate with Parent</span>
                  </CardTitle>
                  <CardDescription>
                    Request changes to this task (points, due date, or description)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {parents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p>No parents available</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label>Select Parent</Label>
                        <Select 
                          value={parentData.recipient_id} 
                          onValueChange={(value) => setParentData(prev => ({ ...prev, recipient_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a parent" />
                          </SelectTrigger>
                          <SelectContent>
                            {parents.map((parent) => (
                              <SelectItem key={parent.id} value={parent.id}>
                                {parent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="requestedPoints">Requested Points</Label>
                          <Input
                            id="requestedPoints"
                            type="number"
                            value={parentData.requested_points}
                            onChange={(e) => setParentData(prev => ({ ...prev, requested_points: parseInt(e.target.value) || 0 }))}
                            min="1"
                          />
                          <p className="text-xs text-gray-500 mt-1">Current: {task.points} points</p>
                        </div>

                        <div>
                          <Label htmlFor="requestedDueDate">Requested Due Date</Label>
                          <Input
                            id="requestedDueDate"
                            type="date"
                            value={parentData.requested_due_date}
                            onChange={(e) => setParentData(prev => ({ ...prev, requested_due_date: e.target.value }))}
                          />
                          {task.due_date && (
                            <p className="text-xs text-gray-500 mt-1">
                              Current: {new Date(task.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="requestedDescription">Requested Description</Label>
                          <Textarea
                            id="requestedDescription"
                            placeholder="Proposed new task description..."
                            value={parentData.requested_description}
                            onChange={(e) => setParentData(prev => ({ ...prev, requested_description: e.target.value }))}
                            rows={3}
                          />
                        </div>

                        <div>
                          <Label htmlFor="parentMessage">Message to Parent</Label>
                          <Textarea
                            id="parentMessage"
                            placeholder="Explain why you're requesting these changes..."
                            value={parentData.offer_message}
                            onChange={(e) => setParentData(prev => ({ ...prev, offer_message: e.target.value }))}
                            rows={2}
                          />
                        </div>

                        <Button 
                          onClick={handleParentNegotiation} 
                          disabled={loading || !parentData.recipient_id}
                          className="w-full"
                        >
                          {loading ? 'Sending Request...' : 'Send Negotiation Request'}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
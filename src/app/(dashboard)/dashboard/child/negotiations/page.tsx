'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { negotiationService } from '@/services/negotiationService'
import { Negotiation, NegotiationStats } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar } from '@/components/ui/avatar'
import { HandHeart, MessageSquare, Clock, User, Calendar, Star, AlertTriangle, ArrowRightLeft, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

export default function NegotiationsPage() {
  const { user, loading: userLoading } = useAuth()
  const [negotiations, setNegotiations] = useState<Negotiation[]>([])
  const [stats, setStats] = useState<NegotiationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('received')
  const [selectedNegotiation, setSelectedNegotiation] = useState<Negotiation | null>(null)
  
  // Counter-offer states
  const [showCounterOfferModal, setShowCounterOfferModal] = useState(false)
  const [counterOfferData, setCounterOfferData] = useState({
    pointsToMe: 0,
    pointsToThem: 0,
    message: ''
  })
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (user) {
      loadNegotiations()
      loadStats()
    }
  }, [user])

  const loadNegotiations = async () => {
    try {
      setLoading(true)
      const data = await negotiationService.getNegotiationsForUser(user!.id)
      setNegotiations(data)
    } catch (error) {
      console.error('Error loading negotiations:', error)
      toast.error('Error loading negotiations')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await negotiationService.getNegotiationStats(user!.id)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleResponse = async (negotiationId: string, responseType: 'accept' | 'reject') => {
    try {
      setProcessing(true)
      await negotiationService.respondToNegotiation(negotiationId, {
        response_type: responseType,
        response_message: responseType === 'accept' ? 'Accepted!' : 'Declined'
      })
      
      toast.success(responseType === 'accept' ? 'Offer accepted! 🎉' : 'Offer declined')
      await loadNegotiations()
      await loadStats()
      setSelectedNegotiation(null)
    } catch (error) {
      console.error('Error responding to negotiation:', error)
      toast.error('Error responding to negotiation')
    } finally {
      setProcessing(false)
    }
  }

  const handleCounterOffer = (negotiation: Negotiation) => {
    const originalOffer = negotiation.points_offered_to_recipient || 0
    const originalKept = negotiation.points_kept_by_initiator || 0
    const totalPoints = originalOffer + originalKept

    setSelectedNegotiation(negotiation)
    setCounterOfferData({
      pointsToMe: Math.floor(totalPoints / 2),
      pointsToThem: Math.ceil(totalPoints / 2),
      message: `Counter-offer for ${negotiation.task?.title}`
    })
    setShowCounterOfferModal(true)
  }

  const handleCounterOfferSubmit = async () => {
    if (!selectedNegotiation) return
    
    try {
      setProcessing(true)
      await negotiationService.respondToNegotiation(selectedNegotiation.id, {
        response_type: 'counter_offer',
        points_offered_to_recipient: counterOfferData.pointsToThem, // Points the original sender will get
        points_kept_by_initiator: counterOfferData.pointsToMe, // Points I (the responder) will keep
        response_message: counterOfferData.message
      })
      
      toast.success('Counter-offer sent! 🔄')
      await loadNegotiations()
      await loadStats()
      setShowCounterOfferModal(false)
      setSelectedNegotiation(null)
      resetCounterOfferData()
    } catch (error: any) {
      console.error('Error sending counter-offer:', error)
      const errorMessage = error?.message || 'Error sending counter-offer'
      toast.error(errorMessage)
    } finally {
      setProcessing(false)
    }
  }

  const resetCounterOfferData = () => {
    setCounterOfferData({
      pointsToMe: 0,
      pointsToThem: 0,
      message: ''
    })
  }

  const getReceivedNegotiations = () => negotiations.filter(n => n.recipient_id === user?.id && n.status === 'pending')
  const getSentNegotiations = () => negotiations.filter(n => n.initiator_id === user?.id)
  const getHistoryNegotiations = () => negotiations.filter(n => n.status !== 'pending')

  const getNegotiationTypeIcon = (negotiation: Negotiation) => {
    return negotiation.negotiation_type === 'sibling_transfer' ? 
      <HandHeart className="w-4 h-4" /> : 
      <MessageSquare className="w-4 h-4" />
  }

  const getNegotiationTypeLabel = (negotiation: Negotiation) => {
    return negotiation.negotiation_type === 'sibling_transfer' ? 'Sibling Transfer' : 'Parent Request'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'accepted': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'expired': return 'bg-gray-100 text-gray-800'
      case 'withdrawn': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isExpired = (negotiation: Negotiation) => {
    if (!negotiation.expires_at) return false
    return new Date(negotiation.expires_at) < new Date()
  }

  const formatExpiration = (expiresAt: string | null) => {
    if (!expiresAt) return null
    const expirationDate = new Date(expiresAt)
    const now = new Date()
    
    if (expirationDate < now) {
      return 'Expired'
    }
    
    return `Expires ${formatDistanceToNow(expirationDate, { addSuffix: true })}`
  }

  if (userLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Task Negotiations</h1>
          <p className="text-gray-600 mt-1">Manage your task transfer offers and parent requests</p>
        </div>
        
        {stats && (
          <div className="flex space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.pending_received}</div>
              <div className="text-sm text-gray-500">Pending Received</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.pending_sent}</div>
              <div className="text-sm text-gray-500">Pending Sent</div>
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="received" className="flex items-center space-x-2">
            <HandHeart className="w-4 h-4" />
            <span>Received ({getReceivedNegotiations().length})</span>
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4" />
            <span>Sent ({getSentNegotiations().length})</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>History ({getHistoryNegotiations().length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Offers and requests you've received from siblings and responses needed from parents
          </div>
          
          {getReceivedNegotiations().length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <HandHeart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No pending negotiations received</p>
                <p className="text-sm text-gray-400 mt-1">
                  When siblings send you transfer offers or parents respond to your requests, they'll appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {getReceivedNegotiations().map((negotiation) => (
                <Card key={negotiation.id} className={`transition-all hover:shadow-lg ${isExpired(negotiation) ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getNegotiationTypeIcon(negotiation)}
                        <CardTitle className="text-lg">{negotiation.task?.title}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{getNegotiationTypeLabel(negotiation)}</Badge>
                        <Badge className={getStatusColor(negotiation.status)}>
                          {negotiation.status}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="flex items-center space-x-4">
                      <span className="flex items-center space-x-2">
                        <Avatar 
                          src={negotiation.initiator?.avatar_url} 
                          alt={negotiation.initiator?.name}
                          size="sm"
                          fallbackName={negotiation.initiator?.name}
                        />
                        <span>From: {negotiation.initiator?.name}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDistanceToNow(new Date(negotiation.created_at), { addSuffix: true })}</span>
                      </span>
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {negotiation.negotiation_type === 'sibling_transfer' && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Point Split Offer:</span>
                          <span className="flex items-center space-x-1 text-sm text-gray-600">
                            <Star className="w-3 h-3" />
                            <span>Original: {negotiation.task?.points} points</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-center p-2 bg-green-100 rounded">
                            <div className="font-medium text-green-800">You Get</div>
                            <div className="text-lg font-bold text-green-900">
                              {negotiation.points_offered_to_recipient} points
                            </div>
                          </div>
                          <div className="text-center p-2 bg-blue-100 rounded">
                            <div className="font-medium text-blue-800">They Keep</div>
                            <div className="text-lg font-bold text-blue-900">
                              {negotiation.points_kept_by_initiator} points
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {negotiation.negotiation_type === 'parent_negotiation' && (
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="font-medium mb-2">Requested Changes:</div>
                        <div className="space-y-2 text-sm">
                          {negotiation.requested_points && (
                            <div className="flex justify-between">
                              <span>Points:</span>
                              <span className="font-medium">{negotiation.task?.points} → {negotiation.requested_points}</span>
                            </div>
                          )}
                          {negotiation.requested_due_date && (
                            <div className="flex justify-between">
                              <span>Due Date:</span>
                              <span className="font-medium">
                                {new Date(negotiation.requested_due_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {negotiation.requested_description && (
                            <div>
                              <span className="font-medium">New Description:</span>
                              <p className="mt-1 text-gray-600">{negotiation.requested_description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {negotiation.offer_message && (
                      <div className="border-l-4 border-blue-400 pl-4">
                        <p className="text-sm italic">"{negotiation.offer_message}"</p>
                      </div>
                    )}

                    {negotiation.expires_at && (
                      <div className={`flex items-center space-x-2 text-sm ${
                        isExpired(negotiation) ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {isExpired(negotiation) ? 
                          <AlertTriangle className="w-4 h-4" /> : 
                          <Clock className="w-4 h-4" />
                        }
                        <span>{formatExpiration(negotiation.expires_at)}</span>
                      </div>
                    )}

                    {!isExpired(negotiation) && (
                      <div className="space-y-2 pt-2">
                        <div className="flex space-x-2">
                          <Button 
                            onClick={() => handleResponse(negotiation.id, 'accept')}
                            className="flex-1"
                            disabled={processing}
                          >
                            Accept Offer
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => handleResponse(negotiation.id, 'reject')}
                            className="flex-1"
                            disabled={processing}
                          >
                            Decline
                          </Button>
                        </div>
                        
                        {negotiation.negotiation_type === 'sibling_transfer' && (
                          <Button 
                            variant="secondary"
                            onClick={() => handleCounterOffer(negotiation)}
                            className="w-full flex items-center justify-center space-x-2"
                            disabled={processing}
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            <span>Make Counter-Offer</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Offers you've sent to siblings and requests you've made to parents
          </div>
          
          {getSentNegotiations().length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No negotiations sent</p>
                <p className="text-sm text-gray-400 mt-1">
                  Send transfer offers to siblings or negotiate with parents from your task list
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {getSentNegotiations().map((negotiation) => (
                <Card key={negotiation.id} className="transition-all hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getNegotiationTypeIcon(negotiation)}
                        <CardTitle className="text-lg">{negotiation.task?.title}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{getNegotiationTypeLabel(negotiation)}</Badge>
                        <Badge className={getStatusColor(negotiation.status)}>
                          {negotiation.status}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="flex items-center space-x-4">
                      <span className="flex items-center space-x-2">
                        <Avatar 
                          src={negotiation.recipient?.avatar_url} 
                          alt={negotiation.recipient?.name}
                          size="sm"
                          fallbackName={negotiation.recipient?.name}
                        />
                        <span>To: {negotiation.recipient?.name}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDistanceToNow(new Date(negotiation.created_at), { addSuffix: true })}</span>
                      </span>
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Similar content structure as received tab but from sender perspective */}
                    {negotiation.negotiation_type === 'sibling_transfer' && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Your Offer:</span>
                          {negotiation.expires_at && (
                            <span className="text-sm text-yellow-600">
                              {formatExpiration(negotiation.expires_at)}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-center p-2 bg-blue-100 rounded">
                            <div className="font-medium text-blue-800">You Keep</div>
                            <div className="text-lg font-bold text-blue-900">
                              {negotiation.points_kept_by_initiator} points
                            </div>
                          </div>
                          <div className="text-center p-2 bg-green-100 rounded">
                            <div className="font-medium text-green-800">They Get</div>
                            <div className="text-lg font-bold text-green-900">
                              {negotiation.points_offered_to_recipient} points
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {negotiation.status === 'pending' && (
                      <Button 
                        variant="outline" 
                        onClick={() => negotiationService.withdrawNegotiation(negotiation.id)}
                        className="w-full"
                      >
                        Withdraw Offer
                      </Button>
                    )}

                    {negotiation.response_message && (
                      <div className="border-l-4 border-green-400 pl-4">
                        <p className="text-sm text-gray-600">Response:</p>
                        <p className="text-sm italic">"{negotiation.response_message}"</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Completed, rejected, and expired negotiations
          </div>
          
          {getHistoryNegotiations().length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No negotiation history</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {getHistoryNegotiations().map((negotiation) => (
                <Card key={negotiation.id} className="opacity-75">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getNegotiationTypeIcon(negotiation)}
                        <CardTitle className="text-lg">{negotiation.task?.title}</CardTitle>
                      </div>
                      <Badge className={getStatusColor(negotiation.status)}>
                        {negotiation.status}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center space-x-2">
                      {negotiation.recipient_id === user?.id ? (
                        <>
                          <span>From:</span>
                          <div className="flex items-center space-x-1">
                            <Avatar 
                              src={negotiation.initiator?.avatar_url} 
                              alt={negotiation.initiator?.name}
                              size="sm"
                              fallbackName={negotiation.initiator?.name}
                            />
                            <span>{negotiation.initiator?.name}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <span>To:</span>
                          <div className="flex items-center space-x-1">
                            <Avatar 
                              src={negotiation.recipient?.avatar_url} 
                              alt={negotiation.recipient?.name}
                              size="sm"
                              fallbackName={negotiation.recipient?.name}
                            />
                            <span>{negotiation.recipient?.name}</span>
                          </div>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(negotiation.created_at), { addSuffix: true })}</span>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Counter-Offer Modal */}
      {showCounterOfferModal && selectedNegotiation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Make Counter-Offer</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setShowCounterOfferModal(false)
                  setSelectedNegotiation(null)
                  resetCounterOfferData()
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">{selectedNegotiation.task?.title}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Total Points: {(selectedNegotiation.points_offered_to_recipient || 0) + (selectedNegotiation.points_kept_by_initiator || 0)}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h5 className="font-medium mb-3">Current Offer:</h5>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center p-2 bg-green-100 rounded">
                    <div className="font-medium">You Get</div>
                    <div className="font-bold">{selectedNegotiation.points_offered_to_recipient} pts</div>
                  </div>
                  <div className="text-center p-2 bg-blue-100 rounded">
                    <div className="font-medium">They Keep</div>
                    <div className="font-bold">{selectedNegotiation.points_kept_by_initiator} pts</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h5 className="font-medium mb-3">Your Counter-Offer:</h5>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="pointsToMe">Points you want:</Label>
                    <Input
                      id="pointsToMe"
                      type="number"
                      value={counterOfferData.pointsToMe}
                      onChange={(e) => {
                        const newPoints = parseInt(e.target.value) || 0
                        const totalPoints = (selectedNegotiation.points_offered_to_recipient || 0) + (selectedNegotiation.points_kept_by_initiator || 0)
                        setCounterOfferData({
                          ...counterOfferData,
                          pointsToMe: newPoints,
                          pointsToThem: totalPoints - newPoints
                        })
                      }}
                      min="0"
                      max={(selectedNegotiation.points_offered_to_recipient || 0) + (selectedNegotiation.points_kept_by_initiator || 0)}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="pointsToThem">Points they get:</Label>
                    <Input
                      id="pointsToThem"
                      type="number"
                      value={counterOfferData.pointsToThem}
                      onChange={(e) => {
                        const newPoints = parseInt(e.target.value) || 0
                        const totalPoints = (selectedNegotiation.points_offered_to_recipient || 0) + (selectedNegotiation.points_kept_by_initiator || 0)
                        setCounterOfferData({
                          ...counterOfferData,
                          pointsToThem: newPoints,
                          pointsToMe: totalPoints - newPoints
                        })
                      }}
                      min="0"
                      max={(selectedNegotiation.points_offered_to_recipient || 0) + (selectedNegotiation.points_kept_by_initiator || 0)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="message">Message (optional):</Label>
                    <Textarea
                      id="message"
                      value={counterOfferData.message}
                      onChange={(e) => setCounterOfferData({
                        ...counterOfferData,
                        message: e.target.value
                      })}
                      placeholder="Add a message to explain your counter-offer..."
                      rows={2}
                    />
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-600">
                  Total must equal {(selectedNegotiation.points_offered_to_recipient || 0) + (selectedNegotiation.points_kept_by_initiator || 0)} points
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button 
                  onClick={handleCounterOfferSubmit}
                  className="flex-1"
                  disabled={
                    processing || 
                    counterOfferData.pointsToMe + counterOfferData.pointsToThem !== 
                    ((selectedNegotiation.points_offered_to_recipient || 0) + (selectedNegotiation.points_kept_by_initiator || 0))
                  }
                >
                  {processing ? 'Sending...' : 'Send Counter-Offer'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCounterOfferModal(false)
                    setSelectedNegotiation(null)
                    resetCounterOfferData()
                  }}
                  className="flex-1"
                  disabled={processing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
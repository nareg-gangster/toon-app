'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { negotiationService } from '@/services/negotiationService'
import { Negotiation, NegotiationStats } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar } from '@/components/ui/avatar'
import { MessageSquare, Clock, User, Calendar, Star, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

export default function ParentNegotiationsPage() {
  const { user, loading: userLoading } = useAuth()
  const [negotiations, setNegotiations] = useState<Negotiation[]>([])
  const [stats, setStats] = useState<NegotiationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('received')

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

  const handleResponse = async (negotiationId: string, responseType: 'accept' | 'reject', message?: string) => {
    try {
      await negotiationService.respondToNegotiation(negotiationId, {
        response_type: responseType,
        response_message: message || (responseType === 'accept' ? 'Request approved!' : 'Request declined')
      })
      
      toast.success(responseType === 'accept' ? 'Request approved! 🎉' : 'Request declined')
      await loadNegotiations()
      await loadStats()
    } catch (error) {
      console.error('Error responding to negotiation:', error)
      toast.error('Error responding to negotiation')
    }
  }

  const getReceivedNegotiations = () => negotiations.filter(n => 
    n.recipient_id === user?.id && 
    n.status === 'pending' &&
    n.negotiation_type === 'parent_negotiation'
  )
  
  const getHistoryNegotiations = () => negotiations.filter(n => 
    n.recipient_id === user?.id && 
    n.status !== 'pending' &&
    n.negotiation_type === 'parent_negotiation'
  )

  const getSiblingTransfers = () => negotiations.filter(n => n.negotiation_type === 'sibling_transfer')

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Family Negotiations</h1>
          <p className="text-gray-600 mt-1">Review children's negotiation requests and monitor sibling transfers</p>
        </div>
        
        {stats && (
          <div className="flex space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{getReceivedNegotiations().length}</div>
              <div className="text-sm text-gray-500">Pending Requests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{getSiblingTransfers().length}</div>
              <div className="text-sm text-gray-500">Sibling Transfers</div>
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="received" className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4" />
            <span>Requests ({getReceivedNegotiations().length})</span>
          </TabsTrigger>
          <TabsTrigger value="transfers" className="flex items-center space-x-2">
            <Star className="w-4 h-4" />
            <span>Transfers ({getSiblingTransfers().length})</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>History ({getHistoryNegotiations().length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Review and respond to your children's negotiation requests for task changes
          </div>
          
          {getReceivedNegotiations().length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No pending negotiation requests</p>
                <p className="text-sm text-gray-400 mt-1">
                  When children request changes to their negotiable tasks, they'll appear here for your review
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {getReceivedNegotiations().map((negotiation) => (
                <Card key={negotiation.id} className="transition-all hover:shadow-lg border-orange-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-orange-600" />
                        <CardTitle className="text-lg">{negotiation.task?.title}</CardTitle>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800">
                        Negotiation Request
                      </Badge>
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
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="font-medium mb-3">Requested Changes:</div>
                      <div className="space-y-3">
                        {negotiation.requested_points && (
                          <div className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="font-medium">Points:</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-500">{negotiation.task?.points}</span>
                              <span>→</span>
                              <span className="font-bold text-orange-600">{negotiation.requested_points}</span>
                            </div>
                          </div>
                        )}
                        
                        {negotiation.requested_due_date && (
                          <div className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="font-medium">Due Date:</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-500">
                                {negotiation.task?.due_date ? 
                                  new Date(negotiation.task.due_date).toLocaleDateString() : 
                                  'No date'
                                }
                              </span>
                              <span>→</span>
                              <span className="font-bold text-orange-600">
                                {new Date(negotiation.requested_due_date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {negotiation.requested_description && (
                          <div className="p-2 bg-white rounded border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">Task Description:</span>
                            </div>
                            <div className="text-sm space-y-2">
                              <div>
                                <span className="text-gray-500">Current:</span>
                                <p className="text-gray-600 italic">{negotiation.task?.description || 'No description'}</p>
                              </div>
                              <div>
                                <span className="text-orange-600 font-medium">Requested:</span>
                                <p className="text-orange-700 font-medium">{negotiation.requested_description}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {negotiation.offer_message && (
                      <div className="border-l-4 border-orange-400 pl-4">
                        <p className="text-sm font-medium text-gray-700">Child's Message:</p>
                        <p className="text-sm italic mt-1">"{negotiation.offer_message}"</p>
                      </div>
                    )}

                    <div className="flex space-x-2 pt-2">
                      <Button 
                        onClick={() => handleResponse(negotiation.id, 'accept')}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve Changes
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => handleResponse(negotiation.id, 'reject', 'Request declined - please complete the task as originally assigned')}
                        className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Monitor sibling-to-sibling task transfers and point sharing agreements
          </div>
          
          {getSiblingTransfers().length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No sibling transfers yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  When children negotiate task transfers with siblings, you'll see the activity here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {getSiblingTransfers().map((negotiation) => (
                <Card key={negotiation.id} className="transition-all hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-blue-600" />
                        <CardTitle className="text-lg">{negotiation.task?.title}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">Sibling Transfer</Badge>
                        <Badge className={getStatusColor(negotiation.status)}>
                          {negotiation.status}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <Avatar 
                          src={negotiation.initiator?.avatar_url} 
                          alt={negotiation.initiator?.name}
                          size="sm"
                          fallbackName={negotiation.initiator?.name}
                        />
                        <span>{negotiation.initiator?.name}</span>
                      </div>
                      <span>→</span>
                      <div className="flex items-center space-x-1">
                        <Avatar 
                          src={negotiation.recipient?.avatar_url} 
                          alt={negotiation.recipient?.name}
                          size="sm"
                          fallbackName={negotiation.recipient?.name}
                        />
                        <span>{negotiation.recipient?.name}</span>
                      </div>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(negotiation.created_at), { addSuffix: true })}</span>
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    {negotiation.status === 'accepted' && (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-green-800">✅ Transfer Completed</span>
                          <span className="text-sm text-green-600">
                            Task reassigned to {negotiation.recipient?.name}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-center p-2 bg-white rounded border">
                            <div className="font-medium">{negotiation.initiator?.name} Earned</div>
                            <div className="text-lg font-bold text-green-700">
                              {negotiation.points_kept_by_initiator} points
                            </div>
                          </div>
                          <div className="text-center p-2 bg-white rounded border">
                            <div className="font-medium">{negotiation.recipient?.name} Earned</div>
                            <div className="text-lg font-bold text-green-700">
                              {negotiation.points_offered_to_recipient} points
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {negotiation.status === 'pending' && (
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-yellow-800">⏳ Awaiting Response</span>
                          <span className="text-sm text-yellow-600">
                            {negotiation.recipient?.name} hasn't responded yet
                          </span>
                        </div>
                        <div className="text-sm text-yellow-700">
                          Offered split: {negotiation.points_kept_by_initiator} pts for {negotiation.initiator?.name}, 
                          {negotiation.points_offered_to_recipient} pts for {negotiation.recipient?.name}
                        </div>
                      </div>
                    )}

                    {negotiation.status === 'rejected' && (
                      <div className="bg-red-50 p-4 rounded-lg">
                        <div className="font-medium text-red-800">❌ Transfer Declined</div>
                        <div className="text-sm text-red-600 mt-1">
                          {negotiation.recipient?.name} declined the offer
                        </div>
                      </div>
                    )}

                    {negotiation.offer_message && (
                      <div className="mt-3 border-l-4 border-blue-400 pl-4">
                        <p className="text-sm italic">"{negotiation.offer_message}"</p>
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
            Previous negotiation requests you've responded to
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
                        <MessageSquare className="w-4 h-4" />
                        <CardTitle className="text-lg">{negotiation.task?.title}</CardTitle>
                      </div>
                      <Badge className={getStatusColor(negotiation.status)}>
                        {negotiation.status}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center space-x-2">
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
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(negotiation.created_at), { addSuffix: true })}</span>
                    </CardDescription>
                  </CardHeader>
                  
                  {negotiation.response_message && (
                    <CardContent>
                      <div className="border-l-4 border-gray-400 pl-4">
                        <p className="text-sm text-gray-600">Your Response:</p>
                        <p className="text-sm italic">"{negotiation.response_message}"</p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
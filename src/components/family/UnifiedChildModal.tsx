// components/family/UnifiedChildModal.tsx - Replaces AddChildModal

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Mail, Eye, EyeOff, CheckCircle, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

interface ChildCreationResult {
  user: {
    id: string
    name: string
    email: string
    points: number
    created_at: string
  }
  temp_password: string
}

interface UnifiedChildModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string; email: string }) => Promise<ChildCreationResult>
  onSendEmail?: (email: string, name: string, password: string) => Promise<void>
  submitting?: boolean
}

export default function UnifiedChildModal({
  isOpen,
  onClose,
  onSubmit,
  onSendEmail,
  submitting = false
}: UnifiedChildModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  })
  const [createdChild, setCreatedChild] = useState<ChildCreationResult | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const result = await onSubmit(formData)
      setCreatedChild(result)
      setStep('success')
    } catch (error) {
      // Error handling done in parent
    }
  }

  const handleSendEmail = async () => {
    if (!onSendEmail || !createdChild) return
    
    setSendingEmail(true)
    try {
      await onSendEmail(
        createdChild.user.email, 
        createdChild.user.name, 
        createdChild.temp_password
      )
      setEmailSent(true)
      toast.success('Login details sent to child\'s email!')
    } catch (error) {
      toast.error('Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleCopyText = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${type} copied!`)
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      toast.success(`${type} copied!`)
    }
  }

  const handleCopyCredentials = () => {
    if (!createdChild) return
    
    const credentials = `Login Details for ${createdChild.user.name}:
Email: ${createdChild.user.email}
Password: ${createdChild.temp_password}

Family Tasks App`
    handleCopyText(credentials, 'Login details')
  }

  const handleClose = () => {
    setStep('form')
    setFormData({ name: '', email: '' })
    setCreatedChild(null)
    setEmailSent(false)
    setShowPassword(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        
        {step === 'form' && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserPlus className="w-5 h-5 mr-2" />
                Add Child to Family
              </CardTitle>
              <CardDescription>
                Add a child who can complete tasks and earn points
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                
                <div className="space-y-2">
                  <Label htmlFor="childName">Child Name</Label>
                  <Input
                    id="childName"
                    placeholder="e.g., Emma Johnson"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="childEmail">Email Address</Label>
                  <Input
                    id="childEmail"
                    type="email"
                    placeholder="emma@family.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-600">
                    They'll be prompted to change their password on first login
                  </p>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-800 font-medium mb-2">What happens next:</p>
                  <ul className="text-xs text-green-700 space-y-1">
                    <li>• Child account created with temporary password</li>
                    <li>• You'll receive their login credentials</li>
                    <li>• They must change password on first login</li>
                    <li>• Can complete tasks and earn points immediately</li>
                  </ul>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? 'Adding Child...' : 'Add Child'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
                    Cancel
                  </Button>
                </div>

              </form>
            </CardContent>
          </>
        )}

        {step === 'success' && createdChild && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Child Account Created!
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-6 w-6 p-0"
                >
                  ✕
                </Button>
              </CardTitle>
              <CardDescription>
                {createdChild.user.name} has been successfully added to your family
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              
              {/* Account Details */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900">Login Details</h3>
                
                <div className="space-y-2">
                  <Label className="text-blue-800">Email</Label>
                  <div className="flex items-center space-x-2">
                    <Input value={createdChild.user.email} readOnly className="bg-white" />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleCopyText(createdChild.user.email, 'Email')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-800">Temporary Password</Label>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Input 
                        value={createdChild.temp_password} 
                        type={showPassword ? 'text' : 'password'} 
                        readOnly 
                        className="bg-white pr-10"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-1 top-1 h-8 w-8"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleCopyText(createdChild.temp_password, 'Password')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                {/* Email Option - Only show if onSendEmail is provided */}
                {onSendEmail && (
                  <Button 
                    className="w-full" 
                    onClick={handleSendEmail}
                    disabled={sendingEmail || emailSent}
                  >
                    {sendingEmail ? (
                      'Sending Email...'
                    ) : emailSent ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Email Sent!
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Login Details via Email
                      </>
                    )}
                  </Button>
                )}

                {/* Copy All Option */}
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleCopyCredentials}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All Details
                </Button>

                {/* Close Button */}
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleClose}
                >
                  Done
                </Button>
              </div>

              {/* Security Note */}
              <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
                <p className="font-medium">Security Tips:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Share these details securely with your child</li>
                  <li>• They'll be prompted to change their password on first login</li>
                  <li>• Keep these details safe until they log in</li>
                </ul>
              </div>

            </CardContent>
          </>
        )}

      </Card>
    </div>
  )
}
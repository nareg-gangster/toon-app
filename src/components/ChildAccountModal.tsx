'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Mail, Eye, EyeOff, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ChildAccountModalProps {
  isOpen: boolean
  onClose: () => void
  childName: string
  childEmail: string
  password: string
  onSendEmail: (email: string, name: string, password: string) => Promise<void>
}

export default function ChildAccountModal({ 
  isOpen, 
  onClose, 
  childName, 
  childEmail, 
  password,
  onSendEmail 
}: ChildAccountModalProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  if (!isOpen) return null

  const handleSendEmail = async () => {
    setSendingEmail(true)
    try {
      await onSendEmail(childEmail, childName, password)
      setEmailSent(true)
      toast.success('Login details sent to child\'s email! 📧')
    } catch (error) {
      toast.error('Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleCopyText = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${type} copied! 📋`)
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      toast.success(`${type} copied! 📋`)
    }
  }

  const handleCopyCredentials = () => {
    const credentials = `Login Details for ${childName}:\nEmail: ${childEmail}\nPassword: ${password}\n\nFamily Tasks App`
    handleCopyText(credentials, 'Login details')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            🎉 Child Account Created!
          </CardTitle>
          <CardDescription>
            {childName} has been successfully added to your family
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Account Details */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900">Login Details</h3>
            
            <div className="space-y-2">
              <Label className="text-blue-800">Email</Label>
              <div className="flex items-center space-x-2">
                <Input value={childEmail} readOnly className="bg-white" />
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleCopyText(childEmail, 'Email')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-blue-800">Password</Label>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Input 
                    value={password} 
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
                  onClick={() => handleCopyText(password, 'Password')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {/* Email Option */}
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
              onClick={onClose}
            >
              Done
            </Button>
          </div>

          {/* Security Note */}
          <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
            <p className="font-medium">💡 Security Tips:</p>
            <ul className="mt-1 space-y-1">
              <li>• Share these details securely with your child</li>
              <li>• Your child can change their password after first login</li>
              <li>• Keep these details safe</li>
            </ul>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
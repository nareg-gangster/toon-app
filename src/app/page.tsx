import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Family Tasks
          </h1>
          <p className="text-gray-600">
            Organize your family, reward great habits
          </p>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">Welcome!</CardTitle>
            <CardDescription className="text-center">
              Get started by creating your family account or signing in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full" size="lg">
              <Link href="/auth/register">
                Create Family Account
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="w-full" size="lg">
              <Link href="/auth/signin">
                Sign In
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Features Preview */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <div className="text-2xl">📝</div>
            <p className="text-xs text-gray-600">Assign Tasks</p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">⭐</div>
            <p className="text-xs text-gray-600">Earn Rewards</p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">👨‍👩‍👧‍👦</div>
            <p className="text-xs text-gray-600">Family Fun</p>
          </div>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'
import { Chrome } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isElectronMode, setIsElectronMode] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const mode = urlParams.get('mode')
    setIsElectronMode(mode === 'electron')
  }, [])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
      if (error) throw error
      // Supabase redirects; in Electron we could handle deep links in future.
    } catch (error: any) {
      console.error('❌ Google login failed:', error)
      alert('An error occurred during login. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Welcome to Revnautix</h1>
        <p className="text-sm text-muted-foreground mt-1">Talk to your CRM</p>
        <p className="text-muted-foreground mt-2">Sign in with your Google account to sync your data across all devices.</p>
        {isElectronMode ? (
          <p className="text-sm text-primary mt-1 font-medium">🔗 Login requested from Electron app</p>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">Local mode will run if you don't sign in.</p>
        )}
      </div>

      <div className="w-full max-w-sm">
        <div className="bg-card text-card-foreground p-8 rounded-lg shadow-md border border-border">
          <Button onClick={handleGoogleSignIn} disabled={isLoading} className="w-full gap-2 justify-center">
            <Chrome className="h-5 w-5" />
            <span>{isLoading ? 'Signing in...' : 'Sign in with Google'}</span>
          </Button>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                if (isElectronMode) {
                  window.location.href = 'revnautix://auth-success?uid=default_user&email=contact@revnautix.com&displayName=Default%20User'
                } else {
                  router.push('/settings')
                }
              }}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Continue in local mode
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
} 
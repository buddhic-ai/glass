import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserProfile, setUserInfo, findOrCreateUser } from './api'
import { supabase } from './supabase'

const defaultLocalUser: UserProfile = {
  uid: 'default_user',
  display_name: 'Default User',
  email: 'contact@revnautix.com',
};

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mode, setMode] = useState<'local' | 'supabase' | null>(null)
  
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const u = session.user
        console.log('🔐 Supabase mode activated:', u.id)
        setMode('supabase')

        let profile: UserProfile = {
          uid: u.id,
          display_name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'User',
          email: u.email || 'no-email@example.com',
        }

        try {
          profile = await findOrCreateUser(profile)
        } catch (error) {
          console.error('User creation/verification failed:', error)
        }

        setUser(profile)
        setUserInfo(profile)
      } else {
        console.log('🏠 Local mode activated')
        setMode('local')
        setUser(defaultLocalUser)
        setUserInfo(defaultLocalUser)
      }
      setIsLoading(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  return { user, isLoading, mode }
}

export const useRedirectIfNotAuth = () => {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // This hook is now simplified. It doesn't redirect for local mode.
    // If you want to force login for hosting mode, you'd add logic here.
    // For example: if (!isLoading && !user) router.push('/login');
    // But for now, we allow both modes.
  }, [user, isLoading, router])

  return user
} 
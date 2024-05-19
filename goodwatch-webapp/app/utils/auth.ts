import { createContext, useContext, useEffect, useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { Session, User } from '@supabase/auth-js'
import { useFetcher } from '@remix-run/react'

interface AuthContext {
  supabase?: SupabaseClient
}

export const AuthContext = createContext<AuthContext>({
  supabase: undefined,
});

export function useSupabase() {
  return useContext(AuthContext);
}

export const useSession = () => {
  const [session, setSession] = useState<Session | null>(null)

  const { supabase } = useSupabase()
  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({data: {session}}) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return session
}

export const useUser = () => {
  const session = useSession()
  const { user } = session || {}
  return user
}

export const useVerifyAuthToken = (session: Session | null) => {
  const fetcher = useFetcher<{ user: User; error?: string }>();

  useEffect(() => {
    if (session?.access_token) {
      fetcher.load(`/api/auth/verify?auth_token=${encodeURIComponent(session.access_token)}`);
    }
  }, [session]);

  return {
    authTokenIsValid: Boolean(fetcher.data?.user?.aud),
    loading: fetcher.state === 'loading',
  };
}

export const getUser = async (token: string, supabase: SupabaseClient) =>{
  if (!token) {
    return { error: 'No token provided' }
  }

  try {
    const { data: user, error } = await supabase.auth.getUser(token)

    if (error) {
      throw error
    }

    if (user) {
      return { user }
    } else {
      return { error: 'Invalid session' }
    }
  } catch (error) {
    return { error: error.message || 'Failed to verify token' }
  }
}

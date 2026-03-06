import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"

import { hasSupabaseEnv, supabase } from "@/lib/supabase"

type AuthResult = {
  error: string | null
}

type SignInParams = {
  email: string
  password: string
}

type SignUpParams = {
  email: string
  password: string
}

type SignUpResult = AuthResult & {
  requiresEmailConfirmation: boolean
}

type AuthContextValue = {
  isAuthenticated: boolean
  isConfigured: boolean
  isLoading: boolean
  session: Session | null
  user: User | null
  signInWithPassword: (params: SignInParams) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  signUpWithPassword: (params: SignUpParams) => Promise<SignUpResult>
}

const missingEnvMessage =
  "Authentication is unavailable until Supabase env vars are configured."

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setIsLoading(false)
      return
    }

    let isMounted = true

    const initializeSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) {
        return
      }

      if (error) {
        console.error("[V3] Failed to initialize auth session:", error.message)
        setSession(null)
      } else {
        setSession(data.session)
      }

      setIsLoading(false)
    }

    void initializeSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = useCallback(
    async ({ email, password }: SignInParams): Promise<AuthResult> => {
      if (!hasSupabaseEnv) {
        return { error: missingEnvMessage }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (!error) {
        setSession(data.session)
      }

      return { error: error?.message ?? null }
    },
    []
  )

  const signUpWithPassword = useCallback(
    async ({ email, password }: SignUpParams): Promise<SignUpResult> => {
      if (!hasSupabaseEnv) {
        return {
          error: missingEnvMessage,
          requiresEmailConfirmation: false,
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        return {
          error: error.message,
          requiresEmailConfirmation: false,
        }
      }

      if (data.session) {
        setSession(data.session)
      }

      return {
        error: null,
        requiresEmailConfirmation: !data.session,
      }
    },
    []
  )

  const signOut = useCallback(async (): Promise<AuthResult> => {
    if (!hasSupabaseEnv) {
      return { error: missingEnvMessage }
    }

    const { error } = await supabase.auth.signOut()

    if (!error) {
      setSession(null)
    }

    return { error: error?.message ?? null }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(session),
      isConfigured: hasSupabaseEnv,
      isLoading,
      session,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      user: session?.user ?? null,
    }),
    [isLoading, session, signInWithPassword, signOut, signUpWithPassword]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.")
  }

  return context
}

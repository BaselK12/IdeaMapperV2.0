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

import { hasSupabaseEnv, normalizeAuthError, supabase } from "@/lib/supabase"

// If neither getSession() nor onAuthStateChange fires within this window,
// we force isLoading → false so the app is never stuck on "Checking session…".
// 8 s gives ample time for a healthy project while keeping degraded-mode UX
// tolerable (e.g. paused Supabase free-tier project returning 503).
const BOOTSTRAP_TIMEOUT_MS = 8_000

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

    // Belt-and-suspenders timeout: if the SDK's initial session check never
    // resolves (e.g. the backend is returning 503 and the SDK is stuck
    // waiting for a token-refresh response), we unblock the UI after
    // BOOTSTRAP_TIMEOUT_MS so users can still reach the sign-in form.
    const bootstrapTimer = setTimeout(() => {
      if (isMounted) {
        console.warn("[V3] Auth bootstrap timed out — treating as unauthenticated.")
        setSession(null)
        setIsLoading(false)
      }
    }, BOOTSTRAP_TIMEOUT_MS)

    const initializeSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (!isMounted) return

        if (error) {
          console.error("[V3] Failed to initialize auth session:", error.message)
          setSession(null)
        } else {
          setSession(data.session)
        }
      } catch (err) {
        // getSession() should not throw, but guard anyway.
        if (isMounted) {
          console.error("[V3] Auth session threw unexpectedly:", err)
          setSession(null)
        }
      } finally {
        if (isMounted) {
          clearTimeout(bootstrapTimer)
          setIsLoading(false)
        }
      }
    }

    void initializeSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      // onAuthStateChange fires INITIAL_SESSION before getSession() resolves
      // in the typical case, so this clears the timer early and unblocks the UI.
      clearTimeout(bootstrapTimer)
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      clearTimeout(bootstrapTimer)
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

      return { error: error ? normalizeAuthError(error.message) : null }
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
          error: normalizeAuthError(error.message),
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

    return { error: error ? normalizeAuthError(error.message) : null }
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

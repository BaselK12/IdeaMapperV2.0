import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().refine(
    (val) => { try { new URL(val); return true } catch { return false } },
    { message: "Must be a valid URL" }
  ),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

const parsedEnv = envSchema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
})

export const hasSupabaseEnv = parsedEnv.success

export const supabaseEnvWarning = hasSupabaseEnv
  ? null
  : "Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable authentication."

if (supabaseEnvWarning) {
  console.warn(`[V3] ${supabaseEnvWarning}`)
}

const env = parsedEnv.success
  ? parsedEnv.data
  : {
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "public-anon-key-placeholder",
    }

export const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
)

/**
 * Translate raw Supabase / browser network error messages into strings safe
 * to show in the UI.  Raw messages like "Failed to fetch" or Supabase's own
 * terse codes ("Invalid login credentials") are replaced with friendly copy.
 * Anything unrecognised is returned as-is so no real detail is silently lost.
 */
export function normalizeAuthError(raw: string | null | undefined): string {
  if (!raw) return "An unexpected error occurred. Please try again."

  const msg = raw.toLowerCase()

  // Network / connectivity failures
  if (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("fetch error")
  ) {
    return "Unable to connect. Check your internet connection and try again."
  }

  // Service unavailable (e.g. paused Supabase project)
  if (msg.includes("503") || msg.includes("service unavailable")) {
    return "The service is temporarily unavailable. Please try again in a moment."
  }

  // Timeout (either a real request timeout or our bootstrap timeout)
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "The request timed out. Please try again."
  }

  // Wrong credentials
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid email or password") ||
    msg.includes("email not found") ||
    msg.includes("wrong password")
  ) {
    return "Incorrect email or password."
  }

  // Email not confirmed
  if (msg.includes("email not confirmed") || msg.includes("email link is invalid or has expired")) {
    return "Check your email for a confirmation link before signing in."
  }

  // Duplicate sign-up
  if (
    msg.includes("user already registered") ||
    msg.includes("already been registered") ||
    msg.includes("email address is already")
  ) {
    return "An account with this email already exists. Try signing in instead."
  }

  // Weak password
  if (msg.includes("password should be at least") || msg.includes("password is too short")) {
    return "Password must be at least 6 characters."
  }

  // Rate limiting
  if (
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("once every 60")
  ) {
    return "Too many attempts. Please wait a moment before trying again."
  }

  // Password reset: expired/missing recovery session
  if (
    msg.includes("auth session missing") ||
    msg.includes("session from url error") ||
    msg.includes("pkce flow") ||
    msg.includes("code verifier")
  ) {
    return "Reset session expired. Please request a new password reset link."
  }

  // Password update: must differ from current
  if (msg.includes("new password should be different")) {
    return "Your new password must be different from your current password."
  }

  // Additional password strength messages from Supabase
  if (msg.includes("password should contain")) {
    return "Password does not meet the security requirements. Please try a stronger one."
  }

  // Return the original message for anything not matched above
  return raw
}

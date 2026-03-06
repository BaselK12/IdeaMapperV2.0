import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
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

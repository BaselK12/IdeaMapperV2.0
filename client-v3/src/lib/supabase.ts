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

if (!hasSupabaseEnv) {
  console.warn(
    "Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. Falling back to placeholder Supabase values."
  )
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

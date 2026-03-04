import { Check, KeyRound } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { hasSupabaseEnv } from "@/lib/supabase"

export function SettingsPage() {
  const supabaseReady = hasSupabaseEnv

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Environment and integration checks for the V3 client.
        </p>
      </div>
      <Card className="max-w-2xl border-slate-200/70 bg-white/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-primary" />
            Supabase Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {supabaseReady ? (
            <span className="inline-flex items-center gap-2 text-emerald-700">
              <Check className="size-4" />
              VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are wired.
            </span>
          ) : (
            <span>Supabase client is not initialized.</span>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"
import { supabaseEnvWarning } from "@/lib/supabase"

type SupabaseWarningProps = {
  className?: string
}

export function SupabaseWarning({ className }: SupabaseWarningProps) {
  if (!supabaseEnvWarning) {
    return null
  }

  return (
    <div
      className={cn(
        "inline-flex w-full items-start gap-2 rounded-md border border-primary/25 bg-primary-soft px-3 py-2 text-xs text-foreground",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <p>{supabaseEnvWarning}</p>
    </div>
  )
}

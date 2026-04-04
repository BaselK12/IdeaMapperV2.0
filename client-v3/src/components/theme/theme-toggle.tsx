import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme/theme-provider"
import type { ThemeMode } from "@/lib/theme"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  className?: string
  compact?: boolean
}

const themeOptions: Array<{
  icon: LucideIcon
  label: string
  value: ThemeMode
}> = [
  {
    icon: Sun,
    label: "Light",
    value: "light",
  },
  {
    icon: Moon,
    label: "Dark",
    value: "dark",
  },
  {
    icon: Monitor,
    label: "System",
    value: "system",
  },
]

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme, theme } = useTheme()

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-border/70 bg-background/85 p-1 shadow-sm",
        compact && "rounded-full",
        className
      )}
    >
      {themeOptions.map(({ icon: Icon, label, value }) => (
        <Button
          aria-label={`Use ${label.toLowerCase()} theme`}
          aria-pressed={theme === value}
          className={cn(
            "h-8 px-2.5 text-xs",
            compact && "size-8 px-0",
            theme !== value && "text-muted-foreground"
          )}
          key={value}
          onClick={() => setTheme(value)}
          size="sm"
          title={
            value === "system"
              ? `System theme (${resolvedTheme})`
              : `${label} theme`
          }
          type="button"
          variant={theme === value ? "default" : "ghost"}
        >
          <Icon className="size-3.5" />
          <span className={compact ? "sr-only" : undefined}>{label}</span>
        </Button>
      ))}
    </div>
  )
}

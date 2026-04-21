import { useEffect } from "react"
import { X } from "lucide-react"

import { AuthCard, type AuthTab } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"

type AuthModalProps = {
  defaultTab?: AuthTab
  onAuthSuccess?: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function AuthModal({
  defaultTab = "signup",
  onAuthSuccess,
  onOpenChange,
  open,
}: AuthModalProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onEscape)
    }
  }, [onOpenChange, open])

  if (!open) {
    return null
  }

  const handleAuthSuccess = () => {
    onAuthSuccess?.()
    onOpenChange(false)
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center p-4"
      role="dialog"
    >
      <button
        aria-label="Close auth modal"
        className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        type="button"
      />
      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <Button
          className="absolute -right-2 -top-2 z-20 rounded-full"
          onClick={() => onOpenChange(false)}
          size="icon"
          type="button"
          variant="secondary"
        >
          <X className="size-4" />
        </Button>
        <AuthCard
          defaultTab={defaultTab}
          key={defaultTab}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    </div>
  )
}

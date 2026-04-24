import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ModalFrameProps = {
  children: ReactNode
  description?: string
  onClose: () => void
  open: boolean
  title: string
}

export function ModalFrame({
  children,
  description,
  onClose,
  open,
  title,
}: ModalFrameProps) {
  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center px-4 py-8">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div className="pointer-events-none absolute right-0 top-12 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-8 h-56 w-56 rounded-full bg-primary-soft/60 blur-3xl" />
      <Card
        className="animate-scale-in relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden border-border/80 bg-card/95 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-primary/70 via-primary to-primary/70" />
        <CardHeader className="shrink-0 flex-row items-start justify-between space-y-0 pb-3">
          <div className="space-y-1.5">
            <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
            {description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            aria-label="Close dialog"
            className="-mr-2 -mt-2 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="overflow-y-auto pb-6">{children}</CardContent>
      </Card>
    </div>,
    document.body
  )
}

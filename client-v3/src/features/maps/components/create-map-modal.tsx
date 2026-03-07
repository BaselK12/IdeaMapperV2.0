import { useEffect, useState, type FormEvent } from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ModalFrame } from "@/features/maps/components/modal-frame"

export type CreateMapFormValues = {
  description: string
  name: string
}

type CreateMapModalProps = {
  errorMessage: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: CreateMapFormValues) => Promise<void>
  open: boolean
}

export function CreateMapModal({
  errorMessage,
  isSubmitting,
  onClose,
  onSubmit,
  open,
}: CreateMapModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [validationMessage, setValidationMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setName("")
      setDescription("")
      setValidationMessage(null)
    }
  }, [open])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim()) {
      setValidationMessage("Map name is required.")
      return
    }

    setValidationMessage(null)

    await onSubmit({
      description,
      name,
    })
  }

  return (
    <ModalFrame
      description="Create a map and jump straight into the workspace."
      onClose={onClose}
      open={open}
      title="New Map"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-primary/20 bg-primary-soft/35 px-3 py-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <Sparkles className="size-3.5" />
            Create map
          </p>
        </div>

        <div className="space-y-2.5">
          <label className="text-sm font-medium text-foreground" htmlFor="new-map-name">
            Map name
          </label>
          <Input
            autoFocus
            id="new-map-name"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder="Product Strategy Q2"
            required
            value={name}
          />
        </div>

        <div className="space-y-2.5">
          <label className="text-sm font-medium text-foreground" htmlFor="new-map-description">
            Description
            <span className="ml-2 text-xs text-muted-foreground">Optional</span>
          </label>
          <textarea
            className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            id="new-map-description"
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional context for collaborators."
            value={description}
          />
        </div>

        {validationMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {validationMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating..." : "Create Map"}
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

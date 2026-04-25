import { useState, type FormEvent } from "react"
import { PencilLine } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ModalFrame } from "@/features/maps/components/modal-frame"

export type MapDetailsFormValues = {
  description: string
  name: string
}

type MapDetailsModalProps = {
  description: string
  errorMessage: string | null
  initialDescription: string
  initialName: string
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: MapDetailsFormValues) => Promise<void>
  open: boolean
  submittingLabel?: string
  submitLabel?: string
  title: string
}

export function MapDetailsModal({
  description,
  errorMessage,
  initialDescription,
  initialName,
  isSubmitting,
  onClose,
  onSubmit,
  open,
  submittingLabel = "Saving...",
  submitLabel = "Save changes",
  title,
}: MapDetailsModalProps) {
  const [name, setName] = useState(initialName)
  const [mapDescription, setMapDescription] = useState(initialDescription)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim()) {
      setValidationMessage("Map name is required.")
      return
    }

    setValidationMessage(null)
    await onSubmit({
      description: mapDescription,
      name,
    })
  }

  return (
    <ModalFrame
      description={description}
      onClose={onClose}
      open={open}
      title={title}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-primary/20 bg-primary-soft/35 px-3 py-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <PencilLine className="size-3.5" />
            Map details
          </p>
        </div>

        <div className="space-y-2.5">
          <label className="text-sm font-medium text-foreground" htmlFor="map-details-name">
            Map name
          </label>
          <Input
            autoFocus
            id="map-details-name"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project roadmap"
            required
            value={name}
          />
        </div>

        <div className="space-y-2.5">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="map-details-description"
          >
            Description
            <span className="ml-2 text-xs text-muted-foreground">Optional</span>
          </label>
          <textarea
            className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            id="map-details-description"
            maxLength={500}
            onChange={(event) => setMapDescription(event.target.value)}
            placeholder="Add context, goals, or the audience for this map."
            value={mapDescription}
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
            {isSubmitting ? submittingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

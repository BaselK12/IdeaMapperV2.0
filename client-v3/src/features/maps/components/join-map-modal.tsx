import { useState, type FormEvent } from "react"
import { Link2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ModalFrame } from "@/features/maps/components/modal-frame"

export type JoinMapFormValues = {
  mapId: string
  mapName: string
}

type JoinMapModalProps = {
  errorMessage: string | null
  infoMessage: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: JoinMapFormValues) => Promise<void>
  open: boolean
}

export function JoinMapModal({
  errorMessage,
  infoMessage,
  isSubmitting,
  onClose,
  onSubmit,
  open,
}: JoinMapModalProps) {
  const [mapName, setMapName] = useState("")
  const [mapId, setMapId] = useState("")
  const [validationMessage, setValidationMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!mapName.trim() || !mapId.trim()) {
      setValidationMessage("Please provide both map name and map ID.")
      return
    }

    setValidationMessage(null)

    await onSubmit({
      mapId,
      mapName,
    })
  }

  return (
    <ModalFrame
      description="Use the exact map name and ID shared by the map owner."
      onClose={onClose}
      open={open}
      title="Join Map"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-primary/20 bg-primary-soft/35 px-3 py-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <Link2 className="size-3.5" />
            Join with map details
          </p>
        </div>

        <div className="space-y-2.5">
          <label className="text-sm font-medium text-foreground" htmlFor="join-map-name">
            Map name
          </label>
          <Input
            autoFocus
            id="join-map-name"
            maxLength={120}
            onChange={(event) => setMapName(event.target.value)}
            placeholder="Product Strategy Q2"
            value={mapName}
          />
        </div>

        <div className="space-y-2.5">
          <label className="text-sm font-medium text-foreground" htmlFor="join-map-id">
            Map ID
          </label>
          <Input
            id="join-map-id"
            onChange={(event) => setMapId(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={mapId}
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
        {infoMessage ? (
          <p className="rounded-md border border-[hsl(var(--success-border))] bg-[hsl(var(--success-soft))] px-3 py-2 text-sm text-[hsl(var(--success-foreground))]">
            {infoMessage}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button onClick={onClose} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Joining..." : "Join Map"}
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

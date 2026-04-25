import { useState, type FormEvent } from "react"
import { LayoutTemplate, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getBuiltInMapTemplates } from "@/features/maps/api/map-presets"
import { ModalFrame } from "@/features/maps/components/modal-frame"
import { cn } from "@/lib/utils"

const builtInTemplates = getBuiltInMapTemplates()

export type CreateMapFormValues = {
  description: string
  name: string
  templateId: string | null
}

type CreateMapModalProps = {
  errorMessage: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: CreateMapFormValues) => Promise<void>
  open: boolean
}

type CreateMapMode = "blank" | "template"

export function CreateMapModal({
  errorMessage,
  isSubmitting,
  onClose,
  onSubmit,
  open,
}: CreateMapModalProps) {
  const [mode, setMode] = useState<CreateMapMode>("blank")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    builtInTemplates[0]?.id ?? null
  )
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [validationMessage, setValidationMessage] = useState<string | null>(null)

  const selectedTemplate =
    builtInTemplates.find((template) => template.id === selectedTemplateId) ?? null

  const applyTemplateSelection = (templateId: string) => {
    const template =
      builtInTemplates.find((entry) => entry.id === templateId) ?? null
    if (!template) {
      return
    }

    setMode("template")
    setSelectedTemplateId(template.id)
    setName(template.suggestedName)
    setDescription(template.suggestedDescription)
    setValidationMessage(null)
  }

  const handleModeChange = (nextMode: CreateMapMode) => {
    setMode(nextMode)
    setValidationMessage(null)

    if (nextMode === "template" && builtInTemplates[0]) {
      applyTemplateSelection(selectedTemplateId ?? builtInTemplates[0].id)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim()) {
      setValidationMessage("Map name is required.")
      return
    }

    if (mode === "template" && !selectedTemplate) {
      setValidationMessage("Choose a template to continue.")
      return
    }

    setValidationMessage(null)

    await onSubmit({
      description,
      name,
      templateId: mode === "template" ? selectedTemplate?.id ?? null : null,
    })
  }

  return (
    <ModalFrame
      description="Create a blank map or start from a built-in template."
      onClose={onClose}
      open={open}
      title="New map"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-primary/20 bg-primary-soft/35 px-3 py-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            {mode === "template" ? (
              <LayoutTemplate className="size-3.5" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {mode === "template" ? "Create from template" : "Create map"}
          </p>
        </div>

        <div className="space-y-2.5">
          <p className="text-sm font-medium text-foreground">Start from</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              className="justify-start"
              onClick={() => handleModeChange("blank")}
              type="button"
              variant={mode === "blank" ? "secondary" : "outline"}
            >
              <Sparkles className="size-4" />
              Blank map
            </Button>
            <Button
              className="justify-start"
              onClick={() => handleModeChange("template")}
              type="button"
              variant={mode === "template" ? "secondary" : "outline"}
            >
              <LayoutTemplate className="size-4" />
              Template
            </Button>
          </div>
        </div>

        {mode === "template" ? (
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-foreground">Built-in templates</p>
            <div className="grid gap-2">
              {builtInTemplates.map((template) => {
                const isSelected = template.id === selectedTemplateId

                return (
                  <button
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-primary/35 bg-primary-soft/30"
                        : "border-border/80 bg-background/70 hover:bg-primary-soft/20"
                    )}
                    key={template.id}
                    onClick={() => applyTemplateSelection(template.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {template.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {template.summary}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {template.graph.nodes.length} nodes
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {template.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-2.5">
          <label className="text-sm font-medium text-foreground" htmlFor="new-map-name">
            Map name
          </label>
          <Input
            autoFocus
            id="new-map-name"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project roadmap"
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
            placeholder="Goal, audience, or a quick note for collaborators."
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
            {isSubmitting
              ? "Creating..."
              : mode === "template"
                ? "Create from template"
                : "Create map"}
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

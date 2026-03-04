import { useQuery } from "@tanstack/react-query"
import { ChartBarIncreasing, FolderKanban, Rocket } from "lucide-react"
import { z } from "zod"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const bootstrapSchema = z.object({
  status: z.string(),
  updatedAt: z.string(),
})

type BootstrapState = z.infer<typeof bootstrapSchema>

const bootstrapState = async (): Promise<BootstrapState> => {
  await new Promise((resolve) => setTimeout(resolve, 200))
  return bootstrapSchema.parse({
    status: "V3 foundation is running",
    updatedAt: new Date().toISOString(),
  })
}

const cards = [
  {
    description: "Use this screen as your launchpad for future feature modules.",
    icon: Rocket,
    title: "Foundation Ready",
  },
  {
    description: "Wire query keys, API modules, and cache strategy from here.",
    icon: ChartBarIncreasing,
    title: "Data Layer Ready",
  },
  {
    description: "Replace placeholders with map list, activity feed, and insights.",
    icon: FolderKanban,
    title: "Layout Ready",
  },
]

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryFn: bootstrapState,
    queryKey: ["bootstrap-state"],
  })

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading V3 status..."
            : `${data?.status} • ${new Date(data?.updatedAt ?? "").toLocaleString()}`}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map(({ description, icon: Icon, title }) => (
          <Card className="border-slate-200/70 bg-white/80 shadow-sm" key={title}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="size-4 text-primary" />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {description}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

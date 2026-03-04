import { ArrowRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function MapsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Maps</h1>
        <p className="text-sm text-muted-foreground">
          Placeholder route for upcoming V3 map list and creation flows.
        </p>
      </div>
      <Card className="max-w-2xl border-slate-200/70 bg-white/80 shadow-sm">
        <CardHeader>
          <CardTitle>Map Workspace Placeholder</CardTitle>
          <CardDescription>
            Connect this to Supabase tables and collaborative state next.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button className="gap-2">
            <Plus className="size-4" />
            New Map
          </Button>
          <Button className="gap-2" variant="outline">
            View Roadmap
            <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}

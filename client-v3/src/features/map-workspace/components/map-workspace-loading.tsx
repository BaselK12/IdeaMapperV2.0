export function MapWorkspaceLoading() {
  return (
    <section className="animate-fade-up flex h-[calc(100vh-2rem)] min-h-[640px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-lg">
      <div className="border-b border-border/70 px-5 py-4 md:px-6 md:py-5">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded-lg bg-muted/80" />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-9 w-full animate-pulse rounded-lg bg-muted/80" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
          <div className="h-full min-h-[320px] animate-pulse rounded-xl bg-muted/70" />
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-20 w-full animate-pulse rounded-xl bg-muted/70" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
        </div>
      </div>
    </section>
  )
}

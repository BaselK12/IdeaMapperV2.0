export function MapWorkspaceLoading() {
  return (
    <section className="animate-fade-up flex flex-col rounded-2xl border border-border/70 bg-card/95 shadow-lg xl:h-[calc(100vh-2rem)] xl:min-h-[640px] xl:overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4 md:px-6 md:py-5">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded-lg bg-muted/80" />
      </div>

      <div className="grid gap-4 p-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <div className="order-2 space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4 xl:order-none">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-9 w-full animate-pulse rounded-lg bg-muted/80" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
        </div>

        <div className="order-1 rounded-2xl border border-border/70 bg-background/80 p-4 xl:order-none">
          <div className="min-h-[22rem] animate-pulse rounded-xl bg-muted/70 sm:min-h-[26rem] xl:h-full xl:min-h-[320px]" />
        </div>

        <div className="order-3 space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4 xl:order-none">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-20 w-full animate-pulse rounded-xl bg-muted/70" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-muted/70" />
        </div>
      </div>
    </section>
  )
}

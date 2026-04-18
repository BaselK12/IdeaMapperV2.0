import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode } from "react"

type Props = {
  children: ReactNode
  /**
   * Custom fallback UI. When omitted, the default card fallback is rendered.
   * The fallback receives no props; if you need error details in a custom
   * fallback, pass a pre-rendered element with the detail baked in.
   */
  fallback?: ReactNode
}

type State = {
  error: Error | null
  hasError: boolean
}

/**
 * Catches unhandled React render/lifecycle errors in the subtree and renders
 * a fallback UI instead of letting the error propagate to a blank screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeFallibleComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<MyCustomFallback />}>
 *     <SomeFallibleComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { error, hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    if (this.props.fallback !== undefined) {
      return this.props.fallback
    }

    // Default fallback — intentionally uses plain <a> and <button> (no
    // React Router Link) so it works even if the router context is broken.
    return (
      <div className="flex min-h-[60svh] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border/70 bg-card/95 p-8 text-center shadow-lg">
          <div className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </div>

          <h2 className="text-xl font-semibold tracking-tight">
            Something went wrong
          </h2>

          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Reload the page or return to your
            dashboard.
          </p>

          {this.state.error?.message ? (
            <p className="rounded-xl border border-border/80 bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              {this.state.error.message}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <a
              className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              href="/app"
            >
              <ArrowLeft className="size-4" />
              Dashboard
            </a>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RotateCcw className="size-4" />
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}

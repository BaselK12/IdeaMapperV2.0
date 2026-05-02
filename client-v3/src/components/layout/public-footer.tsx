import { Link } from "react-router-dom"

export function PublicFooter() {
  return (
    <footer className="border-t border-border/50 bg-background/60">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 md:px-6">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Branchly. Collaborative mind mapping
          for clearer group work.
        </p>
        <div className="flex gap-5">
          <Link
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            to="/pricing"
          >
            Pricing
          </Link>
          <Link
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            to="/privacy"
          >
            Privacy Policy
          </Link>
          <Link
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            to="/terms"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  )
}

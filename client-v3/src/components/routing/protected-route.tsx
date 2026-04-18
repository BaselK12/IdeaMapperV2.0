import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuth } from "@/features/auth/auth-context"

export function ProtectedRoute() {
  const location = useLocation()
  // isLoading is guaranteed to resolve within BOOTSTRAP_TIMEOUT_MS (see auth-context).
  // It will not hang indefinitely even if the Supabase backend is unreachable.
  const { isAuthenticated, isConfigured, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </div>
    )
  }

  if (!isConfigured || !isAuthenticated) {
    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
        to="/auth"
      />
    )
  }

  return <Outlet />
}

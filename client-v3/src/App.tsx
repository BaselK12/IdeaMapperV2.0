import { Navigate, Route, Routes } from "react-router-dom"

import { ErrorBoundary } from "@/components/error-boundary"
import { ProtectedRoute } from "@/components/routing/protected-route"
import { AppShell } from "@/components/layout/app-shell"
import { AuthPage } from "@/pages/auth-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { LandingPage } from "@/pages/landing-page"
import { MapPage } from "@/pages/map-page"
import { NotFoundPage } from "@/pages/not-found-page"
import { PrivacyPage } from "@/pages/privacy-page"
import { ResetPasswordPage } from "@/pages/reset-password-page"
import { SettingsPage } from "@/pages/settings-page"
import { TermsPage } from "@/pages/terms-page"

function App() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<Navigate replace to="/auth" />} path="/login" />
      <Route element={<AuthPage />} path="/auth" />
      <Route element={<ResetPasswordPage />} path="/auth/reset-password" />
      <Route element={<PrivacyPage />} path="/privacy" />
      <Route element={<TermsPage />} path="/terms" />
      <Route element={<Navigate replace to="/app" />} path="/dashboard" />
      <Route element={<ProtectedRoute />} path="/app">
        <Route
          element={
            <ErrorBoundary>
              <AppShell />
            </ErrorBoundary>
          }
        >
          <Route element={<DashboardPage />} index />
          <Route element={<MapPage />} path="map/:mapId" />
          <Route element={<SettingsPage />} path="settings" />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App

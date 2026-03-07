import { Navigate, Route, Routes } from "react-router-dom"

import { ProtectedRoute } from "@/components/routing/protected-route"
import { AppShell } from "@/components/layout/app-shell"
import { AuthPage } from "@/pages/auth-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { LandingPage } from "@/pages/landing-page"
import { MapPage } from "@/pages/map-page"
import { SettingsPage } from "@/pages/settings-page"

function App() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<AuthPage />} path="/auth" />
      <Route element={<ProtectedRoute />} path="/app">
        <Route element={<AppShell />}>
          <Route element={<DashboardPage />} index />
          <Route element={<MapPage />} path="map/:mapId" />
          <Route element={<SettingsPage />} path="settings" />
        </Route>
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

export default App

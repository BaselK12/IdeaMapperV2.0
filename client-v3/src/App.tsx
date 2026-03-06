import { Navigate, Route, Routes } from "react-router-dom"

import { ProtectedRoute } from "@/components/routing/protected-route"
import { AppShell } from "@/components/layout/app-shell"
import { AuthPage } from "@/pages/auth-page"
import { LandingPage } from "@/pages/landing-page"

function App() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<AuthPage />} path="/auth" />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />} path="/app" />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

export default App

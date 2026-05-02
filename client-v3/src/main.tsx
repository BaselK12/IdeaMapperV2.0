import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"

import App from "./App"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { AuthProvider } from "@/features/auth/auth-context"
import { DemoPlanProvider } from "@/features/demo-plan/demo-plan-context"
import "./index.css"

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <DemoPlanProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </DemoPlanProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)

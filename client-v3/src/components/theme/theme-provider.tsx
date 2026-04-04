import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  applyThemePreference,
  getInitialThemeMode,
  getSystemTheme,
  persistTheme,
  resolveThemeMode,
  subscribeToSystemTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme"

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemeMode) => void
  theme: ThemeMode
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialThemeMode())
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    getSystemTheme()
  )

  const resolvedTheme = useMemo(
    () => resolveThemeMode(theme, systemTheme),
    [systemTheme, theme]
  )

  useEffect(() => {
    setSystemTheme(getSystemTheme())
    return subscribeToSystemTheme(setSystemTheme)
  }, [])

  useEffect(() => {
    applyThemePreference(theme, systemTheme)
    persistTheme(theme)
  }, [systemTheme, theme])

  const value = useMemo(
    () => ({
      resolvedTheme,
      setTheme,
      theme,
    }),
    [resolvedTheme, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.")
  }

  return context
}

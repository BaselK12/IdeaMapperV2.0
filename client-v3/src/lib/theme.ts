export type ThemeMode = "light" | "dark" | "system"
export type ResolvedTheme = Exclude<ThemeMode, "system">

export const THEME_STORAGE_KEY = "branchly-theme"
const LEGACY_THEME_STORAGE_KEY = "ideamapper-theme"
export const SYSTEM_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)"

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system"
}

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeMode(storedTheme)) {
      return storedTheme
    }

    const legacyTheme = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
    return isThemeMode(legacyTheme) ? legacyTheme : null
  } catch {
    return null
  }
}

export function getInitialThemeMode(): ThemeMode {
  if (typeof document !== "undefined") {
    const documentTheme = document.documentElement.dataset.themePreference
    if (isThemeMode(documentTheme)) {
      return documentTheme
    }
  }

  return getStoredTheme() ?? "system"
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light"
  }

  return window.matchMedia(SYSTEM_THEME_MEDIA_QUERY).matches ? "dark" : "light"
}

export function resolveThemeMode(
  themeMode: ThemeMode,
  systemTheme: ResolvedTheme
): ResolvedTheme {
  return themeMode === "system" ? systemTheme : themeMode
}

export function applyThemePreference(
  themeMode: ThemeMode,
  systemTheme: ResolvedTheme
): ResolvedTheme {
  if (typeof document === "undefined") {
    return resolveThemeMode(themeMode, systemTheme)
  }

  const resolvedTheme = resolveThemeMode(themeMode, systemTheme)
  const root = document.documentElement

  root.classList.toggle("dark", resolvedTheme === "dark")
  root.dataset.theme = resolvedTheme
  root.dataset.themePreference = themeMode
  root.style.colorScheme = resolvedTheme

  return resolvedTheme
}

export function persistTheme(themeMode: ThemeMode) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY)
  } catch {
    // Ignore storage failures and keep the in-memory theme active.
  }
}

export function subscribeToSystemTheme(
  callback: (theme: ResolvedTheme) => void
) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const mediaQuery = window.matchMedia(SYSTEM_THEME_MEDIA_QUERY)
  const handleChange = (event: MediaQueryListEvent) => {
    callback(event.matches ? "dark" : "light")
  }

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }

  mediaQuery.addListener(handleChange)
  return () => {
    mediaQuery.removeListener(handleChange)
  }
}

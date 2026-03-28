import type { Page } from "@playwright/test"

/**
 * Sign in through the app's login UI.
 * Uses the stable HTML IDs that already exist in auth-card.tsx:
 *   #auth-email, #auth-password, button[type="submit"]
 *
 * Waits for the post-login redirect to /app before returning.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/auth")
  await page.fill("#auth-email", email)
  await page.fill("#auth-password", password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app/, { timeout: 15_000 })
}

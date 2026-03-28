/**
 * TEST 3 — Viewer read-only smoke test
 *
 * A user with role "viewer" on a map must:
 *   • See the "View only" save-status pill (not "Saved" / "Unsaved edits")
 *   • NOT see the "Add node" toolbar button
 *   • NOT see the "Add first node" empty-canvas button
 *
 * The shared test map and viewer participation are set up once in
 * e2e/setup/global-setup.ts and the map ID is read from .test-state.json.
 */
import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import { loginAs } from "./helpers/auth"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { viewerTestMapId } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".test-state.json"), "utf-8")
) as { viewerTestMapId: string }

test("viewer sees read-only UI and cannot add nodes", async ({ page }) => {
  await loginAs(
    page,
    process.env.E2E_VIEWER_EMAIL!,
    process.env.E2E_VIEWER_PASSWORD!
  )

  await page.goto(`/app/map/${viewerTestMapId}`)
  await page.waitForURL(`**/app/map/${viewerTestMapId}`, { timeout: 10_000 })

  // Save-status pill must say "View only" for a viewer
  await expect(page.getByTestId("save-status-pill")).toHaveText("View only", {
    timeout: 10_000,
  })

  // Edit controls must be absent from the DOM entirely (canEdit = false)
  await expect(
    page.getByRole("button", { name: "Add node" })
  ).not.toBeVisible()
  await expect(
    page.getByRole("button", { name: "Add first node" })
  ).not.toBeVisible()
})

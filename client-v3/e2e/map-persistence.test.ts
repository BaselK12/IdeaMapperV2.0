/**
 * TEST 2 — Map persistence smoke test
 *
 * Navigates directly to a pre-created map (set up in globalSetup), adds the
 * first node, waits for the auto-save to complete ("Saved" pill), then reloads
 * and confirms the node still appears in the navigator.
 *
 * Why this is high-value: exercises the full edit → persist → reload → load
 * cycle.  A regression in the save/load path surfaces here before users see it.
 *
 * Why a pre-created map (not UI-created):
 *   Navigating to a map via the SPA create→redirect flow leaves the React
 *   Query graphQuery in a state where it never fetches (isLoading=false,
 *   data=undefined), keeping the save-status pill stuck at "No local edits"
 *   indefinitely.  Direct navigation to a known URL avoids the issue entirely
 *   — the same pattern used by the viewer read-only test.
 */
import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import { loginAs } from "./helpers/auth"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { persistTestMapId } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, ".test-state.json"), "utf-8")
) as { persistTestMapId: string }

test("@smoke node added to a map persists across reload", async ({ page }) => {
  // ── Capture all Supabase REST requests for diagnostics ────────────────
  const supabaseRequests: string[] = []
  page.on("request", (req) => {
    const url = req.url()
    if (url.includes("supabase") || url.includes("rest/v1")) {
      supabaseRequests.push(`→ ${req.method()} ${url.split("?")[0]}`)
    }
  })
  page.on("response", (res) => {
    const url = res.url()
    if (url.includes("supabase") || url.includes("rest/v1")) {
      supabaseRequests.push(`← ${res.status()} ${url.split("?")[0]}`)
    }
  })
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.log(`[browser ${msg.type()}] ${msg.text()}`)
    }
  })
  page.on("pageerror", (err) => {
    console.log(`[pageerror] ${err.message}`)
  })

  await loginAs(
    page,
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!
  )

  console.log(`[test] navigating to /app/map/${persistTestMapId}`)

  // Navigate directly to the pre-created persistence test map
  await page.goto(`/app/map/${persistTestMapId}`)

  // Give the page a moment to settle (auth + workspace + graph queries)
  await page.waitForTimeout(3_000)

  const pillText = await page.getByTestId("save-status-pill").textContent()
  console.log(`[test] pill text after 3s: "${pillText}"`)
  console.log(`[test] supabase requests so far:\n  ${supabaseRequests.join("\n  ")}`)

  // ── Wait for the canvas to be fully hydrated ──────────────────────────
  // An empty map (0 nodes) loads with saveStatus="idle" → "No local edits".
  // A map with prior nodes transitions to "saved" → "Saved" after hydration.
  // Either state means graphQuery has resolved and the editor is ready.
  await expect(page.getByTestId("save-status-pill")).toHaveText(
    /Saved|No local edits/,
    { timeout: 20_000 }
  )

  console.log(`[test] pill reached hydrated state`)
  console.log(`[test] all supabase requests:\n  ${supabaseRequests.join("\n  ")}`)

  // ── Add the first node ─────────────────────────────────────────────────
  await page.getByRole("button", { name: "Add first node" }).click()

  // ── Wait for auto-save to complete ────────────────────────────────────
  // After clicking the pill cycles: "Unsaved edits" → "Saving..." → "Saved"
  await expect(page.getByTestId("save-status-pill")).toHaveText("Saved", {
    timeout: 15_000,
  })

  // ── Reload and verify persistence ──────────────────────────────────────
  await page.reload()

  await expect(
    page.getByTestId("node-navigator-list").locator("li")
  ).toHaveCount(1, { timeout: 10_000 })
})

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"

// ─── Rate limiting ─────────────────────────────────────────────────────────────
// In-memory rolling-window rate limiter keyed by authenticated user ID.
//
// Limit: 20 AI branch generations per user per 60-minute rolling window.
//
// LIMITATION: this store is per function instance. Supabase may run multiple
// edge runtime instances in parallel, so a user hitting different instances
// will see separate counters. In practice this provides meaningful protection
// against runaway single-client usage while requiring zero database migrations.
// Upgrade path: replace with a Supabase DB table if global consistency is needed.
const rateLimitBuckets = new Map<string, number[]>()

const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 20              // requests per window per user

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const cutoff = now - RATE_WINDOW_MS

  const prev = rateLimitBuckets.get(userId) ?? []
  const recent = prev.filter((ts) => ts > cutoff)

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitBuckets.set(userId, recent) // keep cleaned-up list
    return true
  }

  recent.push(now)
  rateLimitBuckets.set(userId, recent)
  return false
}

// Extract the authenticated Supabase user ID from the JWT Bearer token.
// Supabase edge runtime has already verified the JWT signature before this runs.
function getUserId(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!token) return null

  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    // base64url → base64 → JSON
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>
    return typeof payload.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}
// ──────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*",
}

type GenerateRequest = {
  instruction?: string
  mode?: string
  nodeDescription?: string
  nodeTitle: string
}

type AiNode = {
  description?: string
  id: string
  kind: string
  title: string
}

type AiEdge = {
  source: string
  target: string
}

type AiGraph = {
  edges: AiEdge[]
  nodes: AiNode[]
}

type GroqResponse = {
  choices: { message: { content: string } }[]
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  brainstorm: "Generate divergent ideas and angles to explore from this topic. Use kind: idea.",
  checklist: "Generate an actionable step-by-step checklist of things to complete. Use kind: task.",
  research: "Generate open questions that need investigation or validation. Use kind: question.",
  risks: "Generate potential risks, blockers, and failure modes to watch out for. Use kind: decision.",
  roadmap: "Generate sequential phases or milestones for a plan. Use kind: task.",
}

const VALID_KINDS = new Set(["idea", "task", "question", "decision", "resource"])

function parseAiGraph(raw: unknown): AiGraph | null {
  if (typeof raw !== "object" || raw === null) return null
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) return null

  const nodeIds = new Set<string>()
  const nodes: AiNode[] = []

  for (const n of obj.nodes) {
    if (typeof n !== "object" || n === null) continue
    const node = n as Record<string, unknown>
    const id = typeof node.id === "string" ? node.id.trim() : ""
    const title = typeof node.title === "string" ? node.title.trim() : ""
    if (!id || !title || nodeIds.has(id)) continue
    nodeIds.add(id)
    nodes.push({
      ...(typeof node.description === "string" && node.description.trim()
        ? { description: node.description.trim().slice(0, 120) }
        : {}),
      id,
      kind: VALID_KINDS.has(String(node.kind)) ? String(node.kind) : "idea",
      title: title.slice(0, 60),
    })
  }

  if (nodes.length === 0 || !nodeIds.has("root")) return null

  const edges: AiEdge[] = []
  for (const e of obj.edges) {
    if (typeof e !== "object" || e === null) continue
    const edge = e as Record<string, unknown>
    const source = typeof edge.source === "string" ? edge.source.trim() : ""
    const target = typeof edge.target === "string" ? edge.target.trim() : ""
    if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target) || source === target)
      continue
    edges.push({ source, target })
  }

  if (edges.length === 0) return null

  return { edges, nodes }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get("GROQ_API_KEY")
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI generation is not configured on this server." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      )
    }

    // ── Rate limit check (before touching Groq) ──────────────────────────────
    const userId = getUserId(req)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      )
    }

    if (isRateLimited(userId)) {
      return new Response(
        JSON.stringify({ error: "AI generation limit reached. Try again in an hour." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      )
    }
    // ─────────────────────────────────────────────────────────────────────────

    const model = Deno.env.get("GROQ_MODEL") ?? DEFAULT_GROQ_MODEL

    const body = (await req.json()) as GenerateRequest
    const { instruction, mode, nodeDescription, nodeTitle } = body

    if (!nodeTitle || typeof nodeTitle !== "string" || !nodeTitle.trim()) {
      return new Response(
        JSON.stringify({ error: "nodeTitle is required." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    const modeKey = typeof mode === "string" && mode in MODE_DESCRIPTIONS ? mode : "brainstorm"
    const modeDescription = MODE_DESCRIPTIONS[modeKey]

    const descriptionLine =
      typeof nodeDescription === "string" && nodeDescription.trim()
        ? `\nNode description: "${nodeDescription.trim().slice(0, 200)}"`
        : ""
    const instructionLine =
      typeof instruction === "string" && instruction.trim()
        ? `\nExtra instruction: ${instruction.trim().slice(0, 200)}`
        : ""

    const groqRes = await fetch(GROQ_API_URL, {
      body: JSON.stringify({
        max_tokens: 1024,
        messages: [
          {
            content:
              "You are a structured data generator for a mind-mapping tool called Branchly. Output only valid JSON with no markdown fences, no explanation, and no extra text.",
            role: "system",
          },
          {
            content: `Generate a branch for a mind-map node titled "${nodeTitle.trim()}".${descriptionLine}${instructionLine}

Mode: ${modeDescription}

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "nodes": [
    { "id": "root", "title": "string (2-6 words)", "kind": "idea|task|question|decision|resource", "description": "optional, max 80 chars" }
  ],
  "edges": [
    { "source": "string (node id)", "target": "string (node id)" }
  ]
}

Rules:
- The root node must have id exactly "root" — it will connect to the anchor node in the map
- 4 to 7 nodes total including root
- All edges must form a tree rooted at "root" (no cycles, no disconnected nodes)
- Node titles: 2 to 6 words, direct and specific
- Root title: a category or theme label, not a repeat of the anchor title
- Prefer a flat structure (root → children) unless a second level genuinely adds meaning`,
            role: "user",
          },
        ],
        model,
        temperature: 0.7,
      }),
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      throw new Error(`Groq API error ${groqRes.status}: ${errText.slice(0, 200)}`)
    }

    const groqData = (await groqRes.json()) as GroqResponse
    const rawText = groqData.choices?.[0]?.message?.content

    if (!rawText || typeof rawText !== "string") {
      throw new Error("Groq returned an empty response.")
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawText.trim())
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error("Groq returned an invalid response format.")
      parsed = JSON.parse(match[0])
    }

    const graph = parseAiGraph(parsed)
    if (!graph) {
      throw new Error("Groq returned an unexpected graph structure.")
    }

    return new Response(JSON.stringify(graph), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed."
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})

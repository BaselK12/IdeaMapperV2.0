const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"
const MAX_NODES = 150

// ─── Rate limiting ─────────────────────────────────────────────────────────────
// Same in-memory rolling-window strategy as generate-branch.
// LIMITATION: per-instance only; resets on cold start. Upgrade to DB if needed.
const rateLimitBuckets = new Map<string, number[]>()
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 20

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const cutoff = now - RATE_WINDOW_MS
  const prev = rateLimitBuckets.get(userId) ?? []
  const recent = prev.filter((ts) => ts > cutoff)
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitBuckets.set(userId, recent)
    return true
  }
  recent.push(now)
  rateLimitBuckets.set(userId, recent)
  return false
}

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!token) return null
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
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

type SummaryNode = {
  description?: string
  id: string
  kind?: string
  priority?: string
  status?: string
  title: string
  votes?: number
}

type SummaryEdge = {
  note?: string
  source: string
  target: string
}

type SummarizeRequest = {
  edges: SummaryEdge[]
  mapName?: string
  nodes: SummaryNode[]
  scope?: string
}

type AiSummary = {
  actions: string[]
  decisions: string[]
  questions: string[]
  risks: string[]
  summary: string
}

type GroqResponse = {
  choices: { message: { content: string } }[]
}

function buildGraphText(nodes: SummaryNode[], edges: SummaryEdge[]): string {
  const nodeMap = new Map<string, string>()
  for (const n of nodes) nodeMap.set(n.id, n.title)

  const nodeLines: string[] = []
  for (const node of nodes) {
    const parts: string[] = [`[${node.id}] ${node.title}`]
    if (node.kind && node.kind !== "idea") parts.push(`kind:${node.kind}`)
    if (node.status && node.status !== "none") parts.push(`status:${node.status}`)
    if (node.priority && node.priority !== "none") parts.push(`priority:${node.priority}`)
    if (node.votes && node.votes > 0) parts.push(`votes:${node.votes}`)
    if (node.description) parts.push(`— ${node.description.slice(0, 200)}`)
    nodeLines.push(parts.join(" "))
  }

  const edgeLines: string[] = []
  for (const edge of edges) {
    const src = nodeMap.get(edge.source) ?? edge.source
    const tgt = nodeMap.get(edge.target) ?? edge.target
    const note = edge.note ? ` [${edge.note}]` : ""
    edgeLines.push(`${src} → ${tgt}${note}`)
  }

  return [
    "Nodes:",
    ...nodeLines,
    "",
    "Connections:",
    ...edgeLines,
  ].join("\n")
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v) => typeof v === "string" && String(v).trim())
    .map((v) => String(v).trim())
    .slice(0, 8)
}

function parseAiSummary(raw: unknown): AiSummary | null {
  if (typeof raw !== "object" || raw === null) return null
  const obj = raw as Record<string, unknown>
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : ""
  if (!summary) return null
  return {
    actions: toStringArray(obj.actions),
    decisions: toStringArray(obj.decisions),
    questions: toStringArray(obj.questions),
    risks: toStringArray(obj.risks),
    summary,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get("GROQ_API_KEY")
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI summary is not configured on this server." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      )
    }

    const userId = getUserId(req)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      )
    }

    if (isRateLimited(userId)) {
      return new Response(
        JSON.stringify({ error: "AI summary limit reached. Try again in an hour." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      )
    }

    const model = Deno.env.get("GROQ_MODEL") ?? DEFAULT_GROQ_MODEL
    const body = (await req.json()) as SummarizeRequest
    const { edges = [], mapName, nodes = [], scope = "map" } = body

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return new Response(
        JSON.stringify({ error: "nodes array is required and must not be empty." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    if (nodes.length > MAX_NODES) {
      return new Response(
        JSON.stringify({
          error: `Map is too large to summarize (${nodes.length} nodes). Maximum is ${MAX_NODES}.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Sanitize inputs — truncate to safe sizes
    const safeNodes: SummaryNode[] = nodes.map((n) => ({
      ...(n.description?.trim() ? { description: n.description.trim().slice(0, 200) } : {}),
      id: String(n.id ?? "").slice(0, 64),
      ...(n.kind ? { kind: String(n.kind).slice(0, 20) } : {}),
      ...(n.priority && n.priority !== "none" ? { priority: String(n.priority).slice(0, 20) } : {}),
      ...(n.status && n.status !== "none" ? { status: String(n.status).slice(0, 20) } : {}),
      title: String(n.title ?? "").trim().slice(0, 80) || "Untitled",
      ...(typeof n.votes === "number" && n.votes > 0 ? { votes: n.votes } : {}),
    }))

    const nodeIds = new Set(safeNodes.map((n) => n.id))
    const safeEdges: SummaryEdge[] = (edges as SummaryEdge[])
      .filter(
        (e) =>
          typeof e.source === "string" &&
          typeof e.target === "string" &&
          nodeIds.has(e.source) &&
          nodeIds.has(e.target)
      )
      .slice(0, 400)
      .map((e) => ({
        ...(e.note?.trim() ? { note: e.note.trim().slice(0, 120) } : {}),
        source: e.source,
        target: e.target,
      }))

    const safeName =
      typeof mapName === "string" && mapName.trim()
        ? mapName.trim().slice(0, 100)
        : "Untitled map"

    const safeScope = scope === "branch" ? "branch" : "map"
    const graphText = buildGraphText(safeNodes, safeEdges)

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
            content: `Summarize the following mind-map ${safeScope === "branch" ? "branch " : ""}titled "${safeName}".

${graphText}

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "summary": "2-4 sentence overview of the content and purpose",
  "decisions": ["key decision 1"],
  "questions": ["open question 1"],
  "actions": ["action item 1"],
  "risks": ["risk or blocker 1"]
}

Rules:
- summary: 2-4 sentences, direct and informative about the map content
- decisions: key decisions made or implied in the map, empty array [] if none
- questions: open questions needing investigation, empty array [] if none
- actions: concrete next steps or tasks visible in the map, empty array [] if none
- risks: blockers or risks mentioned in the map, empty array [] if none
- Each list item: 1 sentence, specific and direct
- Maximum 5 items per list`,
            role: "user",
          },
        ],
        model,
        temperature: 0.4,
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

    const result = parseAiSummary(parsed)
    if (!result) {
      throw new Error("Groq returned an unexpected summary structure.")
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Summary generation failed."
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})

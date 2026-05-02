// DEMO-ONLY: Simulated plan system for presentation purposes.
// No Stripe, no Supabase billing tables, no real subscriptions.

export type DemoPlan = "free" | "pro" | "team"

export type DemoPlanFeatures = {
  advancedTemplates: boolean
  directInvites: boolean
  frames: boolean
  mentions: boolean
  presentationMode: boolean
  roleControls: boolean
  teamActivity: boolean
  unlimitedMaps: boolean
}

export type DemoPlanLimits = {
  aiBranchPerMonth: number | null
  aiSummaryPerMonth: number | null
  collaboratorsPerMap: number | null
  maps: number | null
  savedViews: number | null
  snapshotsPerMap: number | null
}

export type DemoPlanConfig = {
  badge: string | null
  color: string
  description: string
  features: DemoPlanFeatures
  label: string
  limits: DemoPlanLimits
  price: string
}

export const PLAN_CONFIGS: Record<DemoPlan, DemoPlanConfig> = {
  free: {
    badge: null,
    color: "text-muted-foreground",
    description: "Core mapping, limited AI and storage.",
    features: {
      advancedTemplates: false,
      directInvites: false,
      frames: false,
      mentions: false,
      presentationMode: false,
      roleControls: false,
      teamActivity: false,
      unlimitedMaps: false,
    },
    label: "Free",
    limits: {
      aiBranchPerMonth: 10,
      aiSummaryPerMonth: 5,
      collaboratorsPerMap: 2,
      maps: 3,
      savedViews: 3,
      snapshotsPerMap: 5,
    },
    price: "$0",
  },
  pro: {
    badge: "Most popular",
    color: "text-primary",
    description: "Unlimited AI, more room, presentation mode.",
    features: {
      advancedTemplates: true,
      directInvites: false,
      frames: true,
      mentions: true,
      presentationMode: true,
      roleControls: false,
      teamActivity: false,
      unlimitedMaps: true,
    },
    label: "Pro",
    limits: {
      aiBranchPerMonth: null,
      aiSummaryPerMonth: null,
      collaboratorsPerMap: 15,
      maps: null,
      savedViews: null,
      snapshotsPerMap: null,
    },
    price: "$9",
  },
  team: {
    badge: null,
    color: "text-violet-500",
    description: "Direct invites, roles, team coordination.",
    features: {
      advancedTemplates: true,
      directInvites: true,
      frames: true,
      mentions: true,
      presentationMode: true,
      roleControls: true,
      teamActivity: true,
      unlimitedMaps: true,
    },
    label: "Team",
    limits: {
      aiBranchPerMonth: null,
      aiSummaryPerMonth: null,
      collaboratorsPerMap: null,
      maps: null,
      savedViews: null,
      snapshotsPerMap: null,
    },
    price: "$19",
  },
}

const PLAN_STORAGE_KEY = "branchly:demo:plan"

export function getStoredPlan(): DemoPlan {
  const stored = localStorage.getItem(PLAN_STORAGE_KEY)
  if (stored === "free" || stored === "pro" || stored === "team") return stored
  return "free"
}

export function setStoredPlan(plan: DemoPlan): void {
  localStorage.setItem(PLAN_STORAGE_KEY, plan)
}

// AI usage is tracked per calendar month so Free limits reset naturally.
type AiUsageRecord = { aiBranch: number; aiSummary: number }

function aiUsageKey(): string {
  const d = new Date()
  return `branchly:demo:ai-usage:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function getStoredAiUsage(): AiUsageRecord {
  try {
    const raw = localStorage.getItem(aiUsageKey())
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiUsageRecord>
      return {
        aiBranch: parsed.aiBranch ?? 0,
        aiSummary: parsed.aiSummary ?? 0,
      }
    }
  } catch {
    // ignore
  }
  return { aiBranch: 0, aiSummary: 0 }
}

export function incrementStoredAiUsage(kind: keyof AiUsageRecord): AiUsageRecord {
  const current = getStoredAiUsage()
  const next = { ...current, [kind]: current[kind] + 1 }
  localStorage.setItem(aiUsageKey(), JSON.stringify(next))
  return next
}

export type { AiUsageRecord }

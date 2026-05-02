// DEMO-ONLY: No real billing or subscriptions.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  type AiUsageRecord,
  type DemoPlan,
  type DemoPlanConfig,
  type DemoPlanFeatures,
  type DemoPlanLimits,
  PLAN_CONFIGS,
  getStoredAiUsage,
  getStoredPlan,
  incrementStoredAiUsage,
  setStoredPlan,
} from "@/lib/demo-plan"

type DemoPlanContextValue = {
  aiUsage: AiUsageRecord
  canUseFeature: (feature: keyof DemoPlanFeatures) => boolean
  getLimit: (limit: keyof DemoPlanLimits) => number | null
  incrementAiUsage: (kind: keyof AiUsageRecord) => void
  isAtLimit: (limit: keyof DemoPlanLimits, current: number) => boolean
  plan: DemoPlan
  planConfig: DemoPlanConfig
  setPlan: (plan: DemoPlan) => void
}

const DemoPlanContext = createContext<DemoPlanContextValue | null>(null)

export function DemoPlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlanState] = useState<DemoPlan>(getStoredPlan)
  const [aiUsage, setAiUsage] = useState<AiUsageRecord>(getStoredAiUsage)
  const planConfig = PLAN_CONFIGS[plan]

  const setPlan = useCallback((nextPlan: DemoPlan) => {
    setStoredPlan(nextPlan)
    setPlanState(nextPlan)
  }, [])

  const canUseFeature = useCallback(
    (feature: keyof DemoPlanFeatures) => planConfig.features[feature],
    [planConfig]
  )

  const getLimit = useCallback(
    (limit: keyof DemoPlanLimits) => planConfig.limits[limit],
    [planConfig]
  )

  const isAtLimit = useCallback(
    (limit: keyof DemoPlanLimits, current: number) => {
      const max = planConfig.limits[limit]
      if (max === null) return false
      return current >= max
    },
    [planConfig]
  )

  const incrementAiUsage = useCallback((kind: keyof AiUsageRecord) => {
    setAiUsage(incrementStoredAiUsage(kind))
  }, [])

  const value = useMemo<DemoPlanContextValue>(
    () => ({
      aiUsage,
      canUseFeature,
      getLimit,
      incrementAiUsage,
      isAtLimit,
      plan,
      planConfig,
      setPlan,
    }),
    [aiUsage, canUseFeature, getLimit, incrementAiUsage, isAtLimit, plan, planConfig, setPlan]
  )

  return <DemoPlanContext.Provider value={value}>{children}</DemoPlanContext.Provider>
}

export function useDemoPlan(): DemoPlanContextValue {
  const ctx = useContext(DemoPlanContext)
  if (!ctx) throw new Error("useDemoPlan must be used inside DemoPlanProvider")
  return ctx
}

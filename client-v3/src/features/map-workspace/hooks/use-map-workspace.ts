import { useQuery } from "@tanstack/react-query"

import {
  fetchMapWorkspaceById,
  isValidMapId,
} from "@/features/map-workspace/api/map-workspace-api"

export function useMapWorkspaceQuery(
  mapId: string | undefined,
  userId: string | undefined
) {
  const normalizedMapId = mapId?.trim() ?? ""
  const isEnabled = Boolean(userId && normalizedMapId && isValidMapId(normalizedMapId))

  return useQuery({
    enabled: isEnabled,
    queryFn: async () => fetchMapWorkspaceById(normalizedMapId, userId as string),
    queryKey: ["map-workspace", normalizedMapId, userId ?? "guest"],
    retry: false,
  })
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createMap,
  fetchAccessibleMaps,
  fetchMapHeaderById,
  joinMapWithVerification,
} from "@/features/maps/api/maps-api"
import type {
  CreateMapPayload,
  JoinMapOutcome,
  JoinMapPayload,
} from "@/features/maps/types/maps-types"

function mapsListQueryKey(userId: string) {
  return ["maps", "accessible", userId] as const
}

export function useAccessibleMapsQuery(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async () => fetchAccessibleMaps(userId as string),
    queryKey: userId ? mapsListQueryKey(userId) : ["maps", "accessible", "guest"],
  })
}

export function useCreateMapMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateMapPayload) => createMap(payload),
    onSuccess: async () => {
      if (!userId) {
        return
      }

      await queryClient.invalidateQueries({
        queryKey: mapsListQueryKey(userId),
      })
    },
  })
}

export function useJoinMapMutation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Omit<JoinMapPayload, "userId">): Promise<JoinMapOutcome> => {
      if (!userId) {
        throw new Error("You must be logged in to join a map.")
      }

      return joinMapWithVerification({
        ...payload,
        userId,
      })
    },
    onSuccess: async () => {
      if (!userId) {
        return
      }

      await queryClient.invalidateQueries({
        queryKey: mapsListQueryKey(userId),
      })
    },
  })
}

export function useMapHeaderQuery(mapId: string | undefined) {
  return useQuery({
    enabled: Boolean(mapId),
    queryFn: async () => fetchMapHeaderById(mapId as string),
    queryKey: ["maps", "header", mapId],
  })
}

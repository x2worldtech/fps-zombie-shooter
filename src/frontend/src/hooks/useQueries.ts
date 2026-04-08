import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createActor } from "../backend";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// Re-export leaderboard hook for convenience
export { useLeaderboard } from "./useLeaderboard";

// Local type definitions (backend types not yet generated in bindgen)
export interface PlayerProfile {
  name: string;
  totalScore: bigint;
  totalKills: bigint;
  totalHeadshots: bigint;
  totalWaves: bigint;
  gamesPlayed: bigint;
  totalPoints: bigint;
  currentLevel: bigint;
  totalRounds: bigint;
  totalShots: bigint;
}

export interface SessionStats {
  score: bigint;
  kills: bigint;
  headshots: bigint;
  wave: bigint;
  shots: bigint;
  points: bigint;
}

/**
 * Fetches or creates the authenticated caller's player profile.
 * Only enabled when the user is authenticated.
 */
export function useGetOrCreateProfile() {
  const { actor, isFetching: actorFetching } = useActor(createActor);
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;
  const principalKey = identity?.getPrincipal().toString() ?? null;

  const query = useQuery<PlayerProfile | null>({
    queryKey: ["playerProfile", principalKey],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      if (!isAuthenticated) throw new Error("Not authenticated");
      // biome-ignore lint/suspicious/noExplicitAny: backend not yet fully typed
      return (actor as any).getOrCreateProfile() as Promise<PlayerProfile>;
    },
    enabled: !!actor && !actorFetching && isAuthenticated,
    retry: 2,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

/**
 * Mutation to update the player profile with session stats.
 */
export function useUpdateProfile() {
  const { actor, isFetching: actorFetching } = useActor(createActor);
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const principalKey = identity?.getPrincipal().toString() ?? null;

  return useMutation({
    mutationFn: async (sessionStats: SessionStats) => {
      if (!actor || actorFetching) throw new Error("Actor not ready");
      if (!identity) throw new Error("Not authenticated");
      const principal = identity.getPrincipal();
      // biome-ignore lint/suspicious/noExplicitAny: backend not yet fully typed
      return (actor as any).updateProfile(principal, sessionStats);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["playerProfile", principalKey],
      });
    },
  });
}

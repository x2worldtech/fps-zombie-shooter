import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createActor } from "../backend";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// Local type definition (backend type not yet generated)
export interface ScoreEntry {
  playerName: string;
  score: bigint;
  wave: bigint;
  timestamp: bigint;
}

export function useLeaderboard() {
  const { actor, isFetching } = useActor(createActor);
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  // Include identity in query key so cache is invalidated on auth change
  const principalKey = identity?.getPrincipal().toString() ?? "anonymous";

  const leaderboardQuery = useQuery<ScoreEntry[]>({
    queryKey: ["leaderboard", principalKey],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      // biome-ignore lint/suspicious/noExplicitAny: backend not yet fully typed
      return (actor as any).getHighScores() as Promise<ScoreEntry[]>;
    },
    enabled: !!actor && !isFetching,
    retry: 2,
  });

  const submitMutation = useMutation({
    mutationFn: async ({
      name,
      score,
      wave,
    }: { name: string; score: number; wave: number }) => {
      if (!actor) throw new Error("No actor");
      // biome-ignore lint/suspicious/noExplicitAny: backend not yet fully typed
      await (actor as any).submitScore(name, BigInt(score), BigInt(wave));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });

  return {
    leaderboard: leaderboardQuery.data ?? [],
    isLoading: isFetching || leaderboardQuery.isLoading,
    isError: leaderboardQuery.isError,
    submitScore: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error,
  };
}

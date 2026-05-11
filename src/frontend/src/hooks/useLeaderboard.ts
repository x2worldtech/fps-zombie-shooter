import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// Inline type until backend generates it
interface ScoreEntry {
  playerName: string;
  score: bigint;
  wave: bigint;
  principal?: unknown;
}

export function useLeaderboard() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  // Include identity in query key so cache is invalidated on auth change
  const principalKey = identity?.getPrincipal().toString() ?? "anonymous";

  const leaderboardQuery = useQuery<ScoreEntry[]>({
    queryKey: ["leaderboard", principalKey],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (actor as any).getHighScores();
    },
    enabled: !!actor && !isFetching,
    retry: 2,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ score, wave }: { score: number; wave: number }) => {
      if (!actor) throw new Error("No actor");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (actor as any).submitScore(BigInt(score), BigInt(wave));
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

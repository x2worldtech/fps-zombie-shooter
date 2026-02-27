import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import { ScoreEntry } from '../backend';

export function useLeaderboard() {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  // Include identity in query key so cache is invalidated on auth change
  const principalKey = identity?.getPrincipal().toString() ?? 'anonymous';

  const leaderboardQuery = useQuery<ScoreEntry[]>({
    queryKey: ['leaderboard', principalKey],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getHighScores();
    },
    enabled: !!actor && !isFetching,
    retry: 2,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ name, score, wave }: { name: string; score: number; wave: number }) => {
      if (!actor) throw new Error('No actor');
      await actor.submitScore(name, BigInt(score), BigInt(wave));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
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

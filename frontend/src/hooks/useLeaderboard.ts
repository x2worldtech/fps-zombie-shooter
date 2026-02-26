import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { ScoreEntry } from '../backend';

export function useLeaderboard() {
  const { actor, isFetching } = useActor();
  const queryClient = useQueryClient();

  const leaderboardQuery = useQuery<ScoreEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getHighScores();
    },
    enabled: !!actor && !isFetching,
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
    isLoading: leaderboardQuery.isLoading,
    submitScore: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error,
  };
}

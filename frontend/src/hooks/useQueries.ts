import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { PlayerProfile, SessionStats } from '../backend';
import { useInternetIdentity } from './useInternetIdentity';

// Re-export leaderboard hook for convenience
export { useLeaderboard } from './useLeaderboard';

/**
 * Fetches or creates the authenticated caller's player profile.
 * Only enabled when the user is authenticated.
 */
export function useGetOrCreateProfile() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;

  const query = useQuery<PlayerProfile | null>({
    queryKey: ['playerProfile', identity?.getPrincipal().toString()],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getOrCreateProfile();
    },
    enabled: !!actor && !actorFetching && isAuthenticated,
    retry: false,
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
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionStats: SessionStats) => {
      if (!actor || !identity) throw new Error('Not authenticated');
      const principal = identity.getPrincipal();
      return actor.updateProfile(principal, sessionStats);
    },
    onSuccess: (_, __, ___) => {
      queryClient.invalidateQueries({
        queryKey: ['playerProfile', identity?.getPrincipal().toString()],
      });
    },
  });
}

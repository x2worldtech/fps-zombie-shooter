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
  const principalKey = identity?.getPrincipal().toString() ?? null;

  const query = useQuery<PlayerProfile | null>({
    queryKey: ['playerProfile', principalKey],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      if (!isAuthenticated) throw new Error('Not authenticated');
      return actor.getOrCreateProfile();
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
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const principalKey = identity?.getPrincipal().toString() ?? null;

  return useMutation({
    mutationFn: async (sessionStats: SessionStats) => {
      if (!actor || actorFetching) throw new Error('Actor not ready');
      if (!identity) throw new Error('Not authenticated');
      const principal = identity.getPrincipal();
      return actor.updateProfile(principal, sessionStats);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['playerProfile', principalKey],
      });
    },
  });
}

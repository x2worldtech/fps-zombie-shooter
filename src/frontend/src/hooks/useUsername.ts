import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

/**
 * Query: fetch the caller's stored username from the backend.
 * Returns string | null (null if not yet set).
 */
export function useGetUsername() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;
  const principalKey = identity?.getPrincipal().toString() ?? null;

  return useQuery<string | null>({
    queryKey: ["username", principalKey],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (actor as any).getUsername();
      // Backend returns ?Text → JS optional array [value] or []
      if (Array.isArray(result)) {
        return result.length > 0 ? (result[0] as string) : null;
      }
      return result ?? null;
    },
    enabled: !!actor && !actorFetching && isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 min — username never changes once set
    retry: 2,
  });
}

/**
 * Mutation: set the caller's username (one-time, locked after).
 */
export function useSetUsername() {
  const { actor, isFetching: actorFetching } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const principalKey = identity?.getPrincipal().toString() ?? null;

  return useMutation({
    mutationFn: async (username: string) => {
      if (!actor || actorFetching) throw new Error("Actor not ready");
      if (!identity) throw new Error("Not authenticated");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (actor as any).setUsername(username);
      // Backend may return a variant { ok } or { err: string }
      if (result && typeof result === "object" && "err" in result) {
        throw new Error(String(result.err));
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["username", principalKey] });
    },
  });
}

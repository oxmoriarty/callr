'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@/lib/generated-types';

async function fetchMe(token: string): Promise<User | null> {
  const res = await fetch('/api/auth', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json() as Promise<User>;
}

export function useCurrentUser() {
  const { authenticated, getAccessToken, user: privyUser } = usePrivy();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['currentUser', privyUser?.id],
    queryFn: async () => {
      if (!authenticated) return null;
      const token = await getAccessToken();
      if (!token) return null;
      return fetchMe(token);
    },
    enabled: authenticated,
    staleTime: 5 * 60_000,
  });

  return { user: user ?? null, isLoading, error, isAuthenticated: authenticated };
}

export function useAuthToken() {
  const { getAccessToken } = usePrivy();
  return getAccessToken;
}

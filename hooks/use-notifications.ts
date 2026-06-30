'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './use-current-user';
import { useAuthToken } from './use-current-user';
import { useSocketEvent } from './use-socket-room';
import type { NotificationEvent } from '@/types';

interface NotificationItem {
  id: string;
  type: string;
  message?: string | null;
  read: boolean;
  createdAt: string;
  postId?: string | null;
  marketId?: string | null;
  actor?: {
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  } | null;
}

export function useNotifications() {
  const { user } = useCurrentUser();
  const getToken = useAuthToken();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json() as Promise<{
        data: NotificationItem[];
        unreadCount: number;
        hasMore: boolean;
      }>;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Real-time: invalidate on new notification
  useSocketEvent<NotificationEvent>('notification', () => {
    void qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
  });

  const markRead = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  return { ...query, markRead };
}

export function useNotificationCount(): number {
  const { data } = useNotifications();
  return data?.unreadCount ?? 0;
}

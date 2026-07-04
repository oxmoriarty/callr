'use client';

import { useCurrentUser } from '@/hooks/use-current-user';
import { useUserRoom } from '@/hooks/use-socket-room';

export function UserRoomProvider() {
  const { user } = useCurrentUser();
  useUserRoom(user?.id ?? null);
  return null;
}

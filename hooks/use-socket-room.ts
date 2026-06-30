'use client';

import { useEffect, useCallback } from 'react';
import { useSocket } from '@/app/providers';

export function useMatchRoom(fixtureId: string | null) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !fixtureId) return;
    socket.emit('join:match', fixtureId);
    return () => { socket.emit('leave:match', fixtureId); };
  }, [socket, fixtureId]);
}

export function useUserRoom(userId: string | null) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !userId) return;
    socket.emit('join:user', userId);
  }, [socket, userId]);
}

export function useMarketRoom(marketId: string | null) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !marketId) return;
    socket.emit('join:market', marketId);
  }, [socket, marketId]);
}

export function usePostRoom(postId: string | null) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !postId) return;
    socket.emit('join:post', postId);
  }, [socket, postId]);
}

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const { socket } = useSocket();
  const stableHandler = useCallback(handler, [handler]);

  useEffect(() => {
    if (!socket) return;
    socket.on(event, stableHandler);
    return () => { socket.off(event, stableHandler); };
  }, [socket, event, stableHandler]);
}

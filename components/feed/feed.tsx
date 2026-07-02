'use client';

import { useState, useEffect, useCallback } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PostCard, PostCardSkeleton } from './post-card';
import { useSocketEvent } from '@/hooks/use-socket-room';
import type { PostWithDetails, PaginatedResponse } from '@/types';

interface FeedProps {
  mode?: 'global' | 'following';
  userId?: string; // for profile feeds
  fixtureId?: string; // for match-scoped feeds
}

async function fetchFeedPage(cursor?: string, mode = 'global', userId?: string, fixtureId?: string): Promise<PaginatedResponse<PostWithDetails>> {
  const params = new URLSearchParams({ mode });
  if (cursor) params.set('cursor', cursor);
  if (userId) params.set('userId', userId);
  if (fixtureId) params.set('fixtureId', fixtureId);

  const endpoint = userId ? `/api/users/${userId}/posts` : '/api/feed';
  const res = await fetch(`${endpoint}?${params}`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  return res.json() as Promise<PaginatedResponse<PostWithDetails>>;
}

export function Feed({ mode = 'global', userId, fixtureId }: FeedProps) {
  const qc = useQueryClient();
  const [newPostCount, setNewPostCount] = useState(0);

  const queryKey = ['feed', mode, userId, fixtureId];

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchFeedPage(pageParam as string | undefined, mode, userId, fixtureId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 60_000,
  });

  // Real-time: count new posts without auto-inserting (avoids layout jump)
  useSocketEvent<PostWithDetails>('post:new', (newPost) => {
    // Only show banner for global feed, not profile feeds
    if (!userId) {
      setNewPostCount((c) => c + 1);
      // Prepend to cache silently
      qc.setQueryData(queryKey, (old: ReturnType<typeof useInfiniteQuery>['data']) => {
        if (!old) return old;
        const pages = (old as { pages: PaginatedResponse<PostWithDetails>[] }).pages;
        return {
          ...old,
          pages: [
            { ...pages[0], data: [newPost, ...(pages[0]?.data ?? [])] },
            ...pages.slice(1),
          ],
        };
      });
    }
  });

  const handleShowNew = useCallback(() => {
    setNewPostCount(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Infinite scroll observer
  const handleScroll = useCallback(() => {
    if (
      !isFetchingNextPage &&
      hasNextPage &&
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 400
    ) {
      void fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const allPosts = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="space-y-3">
      {/* New posts banner */}
      <AnimatePresence>
        {newPostCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="sticky top-16 z-40 flex justify-center"
          >
            <button
              onClick={handleShowNew}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-full shadow-glow"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              {newPostCount} new {newPostCount === 1 ? 'post' : 'posts'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-text-muted text-sm mb-3">Failed to load feed</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Posts */}
      {!isLoading && allPosts.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-sm">
            {mode === 'following'
              ? 'Follow people to see their predictions here'
              : 'No predictions yet — be the first!'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {allPosts.map((post, i) => (
          <PostCard key={`${post.id}-${i}`} post={post} />
        ))}
      </div>

      {/* Load more */}
      {isFetchingNextPage && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PostCardSkeleton key={`load-${i}`} />
          ))}
        </div>
      )}

      {!hasNextPage && allPosts.length > 0 && (
        <p className="text-center text-xs text-text-muted py-4">
          You&apos;ve reached the end
        </p>
      )}
    </div>
  );
}

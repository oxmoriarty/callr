'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Repeat2, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives';
import { useCurrentUser, useAuthToken } from '@/hooks/use-current-user';
import { USDC_LAMPORTS } from '@/lib/constants';
import { impliedToDecimal } from '@/lib/odds';
import type { PostWithDetails } from '@/types';

interface PostCardProps {
  post: PostWithDetails;
  compact?: boolean;
}

export function PostCard({ post, compact = false }: PostCardProps) {
  const { user } = useCurrentUser();
  const getToken = useAuthToken();

  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post._count.likes);
  const [liking, setLiking] = useState(false);

  const isSupport = post.side === 'support';
  const stakeUsdc = Number(post.stakeAmount) / USDC_LAMPORTS;
  const hasStake = stakeUsdc > 0;

  const fixture = post.market.fixture;
  const isLive = ['H1', 'H2', 'HT', 'ET1', 'ET2', 'WET', 'WPE', 'PE'].includes(fixture.status);
  const isFinished = ['F', 'FET', 'FPE'].includes(fixture.status);

  const handleLike = useCallback(async () => {
    if (!user || liking) return;
    setLiking(true);

    // Optimistic update
    setLiked((prev) => !prev);
    setLikeCount((prev) => liked ? prev - 1 : prev + 1);

    try {
      const token = await getToken();
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Revert on failure
        setLiked((prev) => !prev);
        setLikeCount((prev) => liked ? prev + 1 : prev - 1);
      }
    } catch {
      setLiked((prev) => !prev);
      setLikeCount((prev) => liked ? prev + 1 : prev - 1);
    } finally {
      setLiking(false);
    }
  }, [user, liking, liked, post.id, getToken]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface border border-border rounded-xl p-4 hover:border-border/80 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/${post.author.username}`}>
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarImage src={post.author.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs">
              {post.author.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          {/* Author + time */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/${post.author.username}`} className="font-medium text-sm hover:underline">
              {post.author.displayName}
            </Link>
            <span className="text-text-muted text-xs">@{post.author.username}</span>
            <span className="text-text-muted text-xs">·</span>
            <span className="text-text-muted text-xs">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>

          {/* Market context */}
          <div className="mt-1.5 mb-2">
            <Link href={`/matches/${fixture.id}`} className="block">
              <div className="inline-flex items-center gap-2 flex-wrap">
                {/* Match */}
                <span className="text-xs text-text-muted">
                  {fixture.homeTeam} vs {fixture.awayTeam}
                </span>

                {/* Live score */}
                {(isLive || isFinished) && (
                  <span className="text-xs font-semibold text-text-primary bg-border px-1.5 py-0.5 rounded">
                    {fixture.homeScore}–{fixture.awayScore}
                  </span>
                )}

                {isLive && (
                  <span className="flex items-center gap-1 text-xs text-live font-medium">
                    <span className="live-dot" />
                    LIVE
                  </span>
                )}
              </div>

              {/* Prediction market */}
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border',
                    isSupport ? 'side-support' : 'side-challenge'
                  )}
                >
                  {isSupport ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {isSupport ? 'Support' : 'Challenge'}
                </span>
                <span className="text-xs text-text-muted font-medium">
                  {post.market.outcomeLabel}
                </span>
                <span className="odds-badge">
                  {impliedToDecimal(post.market.oddsImplied)}×
                </span>
              </div>
            </Link>
          </div>

          {/* Content */}
          <p className="text-sm text-text-primary leading-relaxed">{post.content}</p>

          {/* Stake info */}
          {hasStake && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-text-muted">Staked</span>
              <span className="text-xs font-semibold text-text-primary">
                ${stakeUsdc.toFixed(2)} USDC
              </span>
            </div>
          )}

          {/* Actions */}
          {!compact && (
            <div className="mt-3 flex items-center gap-1 -ml-1.5">
              {/* Like */}
              <button
                onClick={() => void handleLike()}
                disabled={!user}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors',
                  liked
                    ? 'text-loss'
                    : 'text-text-muted hover:text-loss hover:bg-loss/10'
                )}
              >
                <Heart
                  className={cn('w-4 h-4 transition-transform', liking && 'scale-125')}
                  fill={liked ? 'currentColor' : 'none'}
                />
                {likeCount > 0 && <span>{likeCount}</span>}
              </button>

              {/* Comment */}
              <Link
                href={`/posts/${post.id}`}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                {post._count.comments > 0 && <span>{post._count.comments}</span>}
              </Link>

              {/* Repost */}
              <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-win hover:bg-win/10 transition-colors">
                <Repeat2 className="w-4 h-4" />
                {post._count.reposts > 0 && <span>{post._count.reposts}</span>}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="skeleton w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-32" />
          <div className="skeleton h-3 w-48" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Repeat2, TrendingUp, TrendingDown, Trophy, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives';
import { useCurrentUser, useAuthToken } from '@/hooks/use-current-user';
import { USDC_LAMPORTS } from '@/lib/constants';
import { impliedToDecimal, calculatePotentialReturn } from '@/lib/odds';
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
  const [reposted, setReposted] = useState(post.isReposted ?? false);
  const [repostCount, setRepostCount] = useState(post._count.reposts);

  const isSupport = post.side === 'support';
  const stakeUsdc = Number(post.stakeAmount) / USDC_LAMPORTS;
  const hasStake = stakeUsdc > 0;

  const market = post.market;
  const fixture = market.fixture;
  const isLive = ['H1', 'H2', 'HT', 'ET1', 'ET2', 'WET', 'WPE', 'PE'].includes(fixture.status);
  const isFinished = ['F', 'FET', 'FPE'].includes(fixture.status);
  const isSettled = market.status === 'SETTLED';

  // Determine outcome for this post's position
  const won = isSettled && market.winnerSide === post.side;
  const lost = isSettled && market.winnerSide !== post.side && market.winnerSide !== 'void';
  const voided = isSettled && market.winnerSide === 'void';

  const potentialReturn = hasStake
    ? calculatePotentialReturn(stakeUsdc, market.oddsImplied)
    : 0;

  const handleLike = useCallback(async () => {
    if (!user || liking) return;
    setLiking(true);
    setLiked((prev) => !prev);
    setLikeCount((prev) => liked ? prev - 1 : prev + 1);
    try {
      const token = await getToken();
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
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

  const handleRepost = useCallback(async () => {
    if (!user) return;
    setReposted((prev) => !prev);
    setRepostCount((prev) => reposted ? prev - 1 : prev + 1);
    try {
      const token = await getToken();
      const res = await fetch(`/api/posts/${post.id}/repost`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setReposted((prev) => !prev);
        setRepostCount((prev) => reposted ? prev + 1 : prev - 1);
      }
    } catch {
      setReposted((prev) => !prev);
      setRepostCount((prev) => reposted ? prev + 1 : prev - 1);
    }
  }, [user, reposted, post.id, getToken]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-surface border rounded-xl p-4 transition-colors',
        won ? 'border-win/30 hover:border-win/50' :
        lost ? 'border-loss/20 hover:border-loss/30' :
        'border-border hover:border-border/80'
      )}
    >
      {/* Settlement outcome banner */}
      {isSettled && hasStake && (
        <div className={cn(
          'flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs font-medium',
          won ? 'bg-win/10 text-win border border-win/20' :
          lost ? 'bg-loss/10 text-loss border border-loss/20' :
          'bg-border/50 text-text-muted'
        )}>
          {won && <><Trophy className="w-3.5 h-3.5" /> Won · +${(potentialReturn - stakeUsdc).toFixed(2)} USDC</>}
          {lost && <><X className="w-3.5 h-3.5" /> Lost · -${stakeUsdc.toFixed(2)} USDC</>}
          {voided && <>Market voided · Refund pending</>}
        </div>
      )}

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
          {/* Author row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/${post.author.username}`} className="font-semibold text-sm hover:underline">
              {post.author.displayName}
            </Link>
            <span className="text-text-muted text-xs">@{post.author.username}</span>
            <span className="text-border">·</span>
            <span className="text-text-muted text-xs">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>

          {/* Market context pill */}
          <Link href={`/matches/${fixture.id}`} className="block mt-2 mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Side badge */}
              <span className={cn(
                'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border',
                isSupport ? 'side-support' : 'side-challenge'
              )}>
                {isSupport
                  ? <TrendingUp className="w-3 h-3" />
                  : <TrendingDown className="w-3 h-3" />}
                {isSupport ? 'Support' : 'Challenge'}
              </span>

              {/* Market label */}
              <span className="text-xs font-medium text-text-primary">
                {market.outcomeLabel}
              </span>

              {/* Odds */}
              <span className="odds-badge">{impliedToDecimal(market.oddsImplied)}×</span>

              {/* Score / status */}
              <span className="ml-auto flex items-center gap-1.5">
                {(isLive || isFinished) && (
                  <span className="text-xs font-bold text-text-primary tabular-nums">
                    {fixture.homeScore}–{fixture.awayScore}
                  </span>
                )}
                {isLive && (
                  <span className="flex items-center gap-1 text-xs text-live font-semibold">
                    <span className="live-dot" /> LIVE
                  </span>
                )}
                {!isLive && !isFinished && (
                  <span className="text-xs text-text-muted">
                    {fixture.homeTeam} vs {fixture.awayTeam}
                  </span>
                )}
                {isFinished && !isLive && (
                  <span className="text-xs text-text-muted">FT</span>
                )}
              </span>
            </div>
          </Link>

          {/* Post content */}
          <p className="text-sm text-text-primary leading-relaxed">{post.content}</p>

          {/* Stake row */}
          {hasStake && (
            <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
              <span>
                Staked <span className="font-semibold text-text-primary">${stakeUsdc.toFixed(2)}</span>
              </span>
              {!isSettled && (
                <span>
                  To win <span className="font-semibold text-win">${potentialReturn.toFixed(2)}</span>
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          {!compact && (
            <div className="mt-3 flex items-center gap-0.5 -ml-1.5">
              <button
                onClick={() => void handleLike()}
                disabled={!user}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors',
                  liked ? 'text-loss' : 'text-text-muted hover:text-loss hover:bg-loss/10'
                )}
              >
                <Heart className={cn('w-4 h-4', liking && 'scale-110 transition-transform')} fill={liked ? 'currentColor' : 'none'} />
                {likeCount > 0 && <span>{likeCount}</span>}
              </button>

              <Link
                href={`/posts/${post.id}`}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                {post._count.comments > 0 && <span>{post._count.comments}</span>}
              </Link>

              <button
                onClick={() => void handleRepost()}
                disabled={!user}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors',
                  reposted ? 'text-win' : 'text-text-muted hover:text-win hover:bg-win/10'
                )}
              >
                <Repeat2 className="w-4 h-4" />
                {repostCount > 0 && <span>{repostCount}</span>}
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
          <div className="skeleton h-6 w-48 rounded-lg" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

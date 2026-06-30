'use client';

import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Repeat2, UserPlus, Trophy, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives';
import { useNotifications } from '@/hooks/use-notifications';
import { useCurrentUser } from '@/hooks/use-current-user';
import { cn } from '@/lib/utils';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LIKE: Heart,
  COMMENT: MessageCircle,
  REPOST: Repeat2,
  FOLLOW: UserPlus,
  POSITION_WON: Trophy,
  POSITION_LOST: XCircle,
  MARKET_SETTLED: Trophy,
};

const COLORS: Record<string, string> = {
  LIKE: 'text-loss',
  COMMENT: 'text-accent',
  REPOST: 'text-win',
  FOLLOW: 'text-accent',
  POSITION_WON: 'text-win',
  POSITION_LOST: 'text-loss',
  MARKET_SETTLED: 'text-pending',
};

function notificationText(n: { type: string; actor?: { displayName: string } | null; message?: string | null }): string {
  switch (n.type) {
    case 'LIKE': return `${n.actor?.displayName ?? 'Someone'} liked your prediction`;
    case 'COMMENT': return `${n.actor?.displayName ?? 'Someone'} commented on your prediction`;
    case 'REPOST': return `${n.actor?.displayName ?? 'Someone'} reposted your prediction`;
    case 'FOLLOW': return `${n.actor?.displayName ?? 'Someone'} started following you`;
    default: return n.message ?? 'New notification';
  }
}

export default function NotificationsPage() {
  const { user } = useCurrentUser();
  const { data, isLoading, markRead } = useNotifications();

  if (!user) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-text-muted">Sign in to see your notifications</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Notifications</h1>
        {data && data.unreadCount > 0 && (
          <button
            onClick={() => markRead.mutate()}
            className="text-xs text-accent font-medium hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && data?.data.length === 0 && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-sm">No notifications yet</p>
        </div>
      )}

      <div className="space-y-1.5">
        {data?.data.map((n) => {
          const Icon = ICONS[n.type] ?? Heart;
          const color = COLORS[n.type] ?? 'text-accent';

          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                n.read ? 'bg-surface border-border' : 'bg-accent/5 border-accent/20'
              )}
            >
              <div className={cn('shrink-0', color)}>
                <Icon className="w-5 h-5" />
              </div>

              {n.actor && (
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={n.actor.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {n.actor.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">{notificationText(n)}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

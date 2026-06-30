'use client';

import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Feed } from '@/components/feed/feed';
import { useCurrentUser, useAuthToken } from '@/hooks/use-current-user';
import type { UserProfile } from '@/types';

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const { user: currentUser } = useCurrentUser();
  const getToken = useAuthToken();
  const qc = useQueryClient();
  const [followLoading, setFollowLoading] = useState(false);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile', params.username],
    queryFn: async () => {
      const res = await fetch(`/api/users/${params.username}`);
      if (!res.ok) throw new Error('User not found');
      return res.json() as Promise<UserProfile>;
    },
  });

  const handleFollow = async () => {
    if (!profile || !currentUser) return;
    setFollowLoading(true);
    try {
      const token = await getToken();
      await fetch(`/api/users/${profile.id}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await qc.invalidateQueries({ queryKey: ['profile', params.username] });
    } finally {
      setFollowLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        <div className="skeleton h-32 rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-text-muted">User not found</p>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-border rounded-xl p-6 mb-4"
      >
        <div className="flex items-start justify-between">
          <Avatar className="w-16 h-16">
            <AvatarImage src={profile.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xl">
              {profile.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {!isOwnProfile && currentUser && (
            <Button
              variant={profile.isFollowing ? 'outline' : 'default'}
              size="sm"
              loading={followLoading}
              onClick={() => void handleFollow()}
            >
              {profile.isFollowing ? 'Following' : 'Follow'}
            </Button>
          )}
        </div>

        <h1 className="text-xl font-bold mt-4">{profile.displayName}</h1>
        <p className="text-text-muted text-sm">@{profile.username}</p>

        {profile.bio && (
          <p className="text-sm text-text-primary mt-3 leading-relaxed">{profile.bio}</p>
        )}

        <div className="flex items-center gap-1.5 text-xs text-text-muted mt-3">
          <Calendar className="w-3.5 h-3.5" />
          Joined {new Date(profile.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' })}
        </div>

        <div className="flex items-center gap-5 mt-4 text-sm">
          <span><strong>{profile._count.posts}</strong> <span className="text-text-muted">Predictions</span></span>
          <span><strong>{profile._count.followers}</strong> <span className="text-text-muted">Followers</span></span>
          <span><strong>{profile._count.following}</strong> <span className="text-text-muted">Following</span></span>
        </div>
      </motion.div>

      <Feed userId={profile.id} />
    </div>
  );
}

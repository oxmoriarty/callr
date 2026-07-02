'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { PostCard } from '@/components/feed/post-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives';
import { Textarea } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { useCurrentUser, useAuthToken } from '@/hooks/use-current-user';
import { usePostRoom, useSocketEvent } from '@/hooks/use-socket-room';
import type { PostWithDetails } from '@/types';

const commentSchema = z.object({ content: z.string().min(1).max(280) });
type CommentForm = z.input<typeof commentSchema>;

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null };
}

interface PostDetail extends PostWithDetails {
  comments: Comment[];
}

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const { user } = useCurrentUser();
  const getToken = useAuthToken();

  usePostRoom(postId);

  const { data: post, isLoading } = useQuery<PostDetail>({
    queryKey: ['post', postId],
    queryFn: async () => {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/posts/${postId}`, { headers });
      if (!res.ok) throw new Error('Post not found');
      return res.json() as Promise<PostDetail>;
    },
  });

  // Real-time new comments
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  useSocketEvent<Comment>('post:comment', (comment) => {
    setLocalComments((prev) => [...prev, comment]);
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CommentForm>({
    resolver: zodResolver(commentSchema),
  });

  const commentMutation = useMutation({
    mutationFn: async (data: CommentForm) => {
      const token = await getToken();
      const res = await fetch(`/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json() as Promise<Comment>;
    },
    onSuccess: (comment) => {
      setLocalComments((prev) => [...prev, comment]);
      reset();
    },
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        <div className="skeleton h-8 w-32 rounded-lg" />
        <div className="skeleton h-48 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="px-4 py-12 max-w-2xl mx-auto text-center">
        <p className="text-text-muted">Post not found</p>
        <Link href="/" className="text-accent text-sm mt-2 block">← Back to feed</Link>
      </div>
    );
  }

  const allComments = [
    ...(post.comments ?? []),
    ...localComments.filter((c) => !post.comments?.find((pc) => pc.id === c.id)),
  ];

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      {/* Back nav */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Feed
      </Link>

      {/* Post */}
      <PostCard post={post} />

      {/* Market context strip */}
      <div className="mt-3 p-4 bg-surface border border-border rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-label">Market</p>
            <p className="text-sm font-medium mt-0.5">{post.market.outcomeLabel}</p>
            <p className="text-xs text-text-muted">
              {post.market.fixture.homeTeam} vs {post.market.fixture.awayTeam}
            </p>
          </div>
          <Link href={`/matches/${post.market.fixture.id}`}>
            <Button variant="outline" size="sm">View match</Button>
          </Link>
        </div>
      </div>

      {/* Comments */}
      <div className="mt-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-label mb-3">
          {allComments.length > 0 ? `${allComments.length} Comments` : 'Comments'}
        </h2>

        {allComments.length === 0 && (
          <div className="bg-surface border border-border rounded-xl p-8 text-center mb-4">
            <p className="text-text-muted text-sm">No comments yet — be the first</p>
          </div>
        )}

        <div className="space-y-3 mb-4">
          {allComments.map((comment) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <Link href={`/${comment.author.username}`}>
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={comment.author.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {comment.author.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <Link
                    href={`/${comment.author.username}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {comment.author.displayName}
                  </Link>
                  <span className="text-xs text-text-muted">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-text-primary mt-0.5 leading-relaxed">{comment.content}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Comment composer */}
        {user ? (
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 shrink-0 mt-0.5">
                <AvatarImage src={user.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs">
                  {user.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  {...register('content')}
                  placeholder="Add a comment…"
                  rows={2}
                  className="bg-transparent border-0 px-0 py-0 resize-none focus:ring-0 text-sm"
                />
                {errors.content && (
                  <p className="text-xs text-loss mt-1">{errors.content.message}</p>
                )}
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    loading={commentMutation.isPending}
                    onClick={() => void handleSubmit((d) => commentMutation.mutate(d))()}
                  >
                    Reply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-text-muted text-sm">
              <Link href="/login" className="text-accent hover:underline">Sign in</Link> to comment
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

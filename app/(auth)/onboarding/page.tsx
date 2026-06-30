'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/primitives';
import { useQueryClient } from '@tanstack/react-query';

const schema = z.object({
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(20, 'Max 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, and underscores only'),
  displayName: z.string().min(1, 'Required').max(50),
});

type FormData = z.infer<typeof schema>;

export default function OnboardingPage() {
  const { getAccessToken, user: privyUser } = usePrivy();
  const router = useRouter();
  const qc = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: privyUser?.email?.address?.split('@')[0] ?? '',
      username: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? 'Failed to create profile');
      }

      await qc.invalidateQueries({ queryKey: ['currentUser'] });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <h1 className="text-2xl font-bold mb-1 text-center">Set up your profile</h1>
        <p className="text-text-muted text-sm mb-8 text-center">
          Choose how you&apos;ll appear to other predictors
        </p>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" {...register('displayName')} placeholder="Alex Smith" />
            {errors.displayName && <p className="text-xs text-loss">{errors.displayName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">@</span>
              <Input
                id="username"
                {...register('username')}
                placeholder="alexsmith"
                className="pl-7"
              />
            </div>
            {errors.username && <p className="text-xs text-loss">{errors.username.message}</p>}
          </div>

          {error && (
            <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg">
              <p className="text-xs text-loss">{error}</p>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Create account
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

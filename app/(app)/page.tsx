'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostComposer } from '@/components/feed/post-composer';
import { Feed } from '@/components/feed/feed';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function HomePage() {
  const { user } = useCurrentUser();
  const [tab, setTab] = useState<'global' | 'following'>('global');

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <PostComposer />

      <div className="mt-4 mb-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'global' | 'following')}>
          <TabsList>
            <TabsTrigger value="global">For You</TabsTrigger>
            {user && <TabsTrigger value="following">Following</TabsTrigger>}
          </TabsList>
        </Tabs>
      </div>

      <Feed mode={tab} />
    </div>
  );
}

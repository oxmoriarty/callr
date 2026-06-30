'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, Bell, Wallet, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useNotificationCount } from '@/hooks/use-notifications';

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Feed' },
  { href: '/matches', icon: Trophy, label: 'Matches' },
  { href: '/notifications', icon: Bell, label: 'Alerts' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const unreadCount = useNotificationCount();

  if (!user) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass border-t border-border/60">
      <div className="flex items-center justify-around h-16 px-2 safe-area-bottom">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          const isNotif = href === '/notifications';

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors relative',
                active ? 'text-text-primary' : 'text-text-muted'
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {isNotif && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-accent text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-accent rounded-full" />
              )}
            </Link>
          );
        })}
        <Link
          href={`/${user.username}`}
          className={cn(
            'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors',
            pathname === `/${user.username}` ? 'text-text-primary' : 'text-text-muted'
          )}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>
    </nav>
  );
}

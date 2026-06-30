'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Bell, Search, Wallet, Home, Trophy, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useNotificationCount } from '@/hooks/use-notifications';

const NAV_LINKS = [
  { href: '/', label: 'Feed', icon: Home },
  { href: '/matches', label: 'Matches', icon: Trophy },
];

export function Navbar() {
  const pathname = usePathname();
  const { logout } = usePrivy();
  const { user } = useCurrentUser();
  const unreadCount = useNotificationCount();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <svg viewBox="0 0 120 36" width="90" height="27" aria-label="Callr">
            {/* Football */}
            <circle cx="18" cy="18" r="14" fill="none" stroke="#fff" strokeWidth="1.5"/>
            <polygon points="18,7 24,12 22,20 14,20 12,12" fill="#1800AD"/>
            <line x1="18" y1="7" x2="12" y2="12" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
            <line x1="18" y1="7" x2="24" y2="12" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
            <line x1="12" y1="12" x2="6" y2="18" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
            <line x1="24" y1="12" x2="30" y2="18" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
            <line x1="14" y1="20" x2="10" y2="27" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
            <line x1="22" y1="20" x2="26" y2="27" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
            {/* Text */}
            <text x="38" y="25" fontFamily="Inter,sans-serif" fontSize="20" fontWeight="700" fill="#fff">callr</text>
          </svg>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'text-text-primary bg-surface'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface/60'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <Link href="/search">
            <Button variant="ghost" size="icon" className="text-text-muted hover:text-text-primary">
              <Search className="w-4 h-4" />
            </Button>
          </Link>

          {user ? (
            <>
              {/* Notifications */}
              <Link href="/notifications" className="relative">
                <Button variant="ghost" size="icon" className="text-text-muted hover:text-text-primary">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </motion.span>
                  )}
                </Button>
              </Link>

              {/* Wallet */}
              <Link href="/wallet">
                <Button variant="ghost" size="icon" className="text-text-muted hover:text-text-primary">
                  <Wallet className="w-4 h-4" />
                </Button>
              </Link>

              {/* Profile dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none">
                    <Avatar className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-border transition-all">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {user.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-text-primary">{user.displayName}</p>
                    <p className="text-xs text-text-muted">@{user.username}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/${user.username}`} className="cursor-pointer">
                      <User className="w-4 h-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/wallet" className="cursor-pointer">
                      <Wallet className="w-4 h-4" />
                      Wallet
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-loss cursor-pointer"
                    onClick={() => void logout()}
                  >
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

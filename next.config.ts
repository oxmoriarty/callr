import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.privy.io' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: 'abs.twimg.com' },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  serverExternalPackages: [
    '@prisma/client',
    '@coral-xyz/anchor',
    '@solana/web3.js',
    'tweetnacl',
    'eventsource',
    'socket.io',
  ],
};

export default nextConfig;

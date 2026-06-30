import { NextRequest } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { prisma } from '@/lib/prisma';
import type { User } from '@/lib/generated-types';

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '',
  process.env.PRIVY_APP_SECRET ?? ''
);

export async function getServerUser(req: NextRequest): Promise<User | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    const verifiedClaims = await privyClient.verifyAuthToken(token);

    const user = await prisma.user.findUnique({
      where: { privyId: verifiedClaims.userId },
    });

    return user;
  } catch {
    return null;
  }
}

export async function requireUser(req: NextRequest): Promise<User> {
  const user = await getServerUser(req);
  if (!user) throw new AuthError('Unauthorized');
  return user;
}

export class AuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

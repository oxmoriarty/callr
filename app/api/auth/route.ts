import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/auth-server';
import { PrivyClient } from '@privy-io/server-auth';

const privyClient = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '',
  process.env.PRIVY_APP_SECRET ?? ''
);

const createUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/, 'Username may only contain lowercase letters, numbers, and underscores'),
  displayName: z.string().min(1).max(50),
});

// GET /api/auth/me — returns current user or 404
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(user);
}

// POST /api/auth/register — called on first login to create profile
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const verifiedClaims = await privyClient.verifyAuthToken(token);

    const body = await req.json() as unknown;
    const { username, displayName } = createUserSchema.parse(body);

    // Check username availability
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    // Get or create user
    const existingUser = await prisma.user.findUnique({
      where: { privyId: verifiedClaims.userId },
    });

    if (existingUser) {
      return NextResponse.json(existingUser);
    }

    // Get wallet address from Privy
    const privyUser = await privyClient.getUser(verifiedClaims.userId);
    const solanaWallet = privyUser.linkedAccounts?.find(
      (a) => a.type === 'wallet' && (a as { chainType?: string }).chainType === 'solana'
    );

    const user = await prisma.user.create({
      data: {
        privyId: verifiedClaims.userId,
        username,
        displayName,
        walletAddress: (solanaWallet as { address?: string } | undefined)?.address,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: err.errors }, { status: 400 });
    }
    console.error('[API/auth] Error:', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}

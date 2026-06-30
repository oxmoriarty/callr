import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerUser } from '@/lib/auth-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const currentUser = await getServerUser(req);

    // id can be a userId or username
    const user = await prisma.user.findFirst({
      where: id.startsWith('c') ? { id } : { username: id },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        walletAddress: true,
        createdAt: true,
        _count: {
          select: { posts: true, followers: true, following: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let isFollowing = false;
    if (currentUser && currentUser.id !== user.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUser.id,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!follow;
    }

    return NextResponse.json({ ...user, isFollowing });
  } catch (err) {
    console.error('[API/users/:id] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const currentUser = await getServerUser(req);
    if (!currentUser || currentUser.id !== id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as { displayName?: string; bio?: string; avatarUrl?: string };

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(body.displayName && { displayName: body.displayName }),
        ...(body.bio !== undefined && { bio: body.bio }),
        ...(body.avatarUrl && { avatarUrl: body.avatarUrl }),
      },
      select: {
        id: true, username: true, displayName: true, bio: true, avatarUrl: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[API/users/:id PATCH] Error:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

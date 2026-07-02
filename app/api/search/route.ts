import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q')?.trim() ?? '';

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [], fixtures: [] });
  }

  const [users, fixtures] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        _count: { select: { followers: true } },
      },
      take: 8,
    }),
    prisma.fixture.findMany({
      where: {
        OR: [
          { homeTeam: { contains: q, mode: 'insensitive' } },
          { awayTeam: { contains: q, mode: 'insensitive' } },
          { competition: { contains: q, mode: 'insensitive' } },
        ],
        status: { not: 'F' },
      },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        competition: true,
        startTime: true,
        status: true,
      },
      take: 6,
      orderBy: { startTime: 'asc' },
    }),
  ]);

  return NextResponse.json({ users, fixtures });
}

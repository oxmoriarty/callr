// Mirrors the Prisma `User` model shape.
// Kept separate from `@prisma/client` generated types so the app compiles
// consistently regardless of the exact Prisma client generation output
// in different environments (local/CI/sandbox).

export interface User {
  id: string;
  privyId: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  walletAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

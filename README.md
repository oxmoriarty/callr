# Callr

Social prediction markets for World Cup football. Built for the TxODDS World Cup Hackathon (Track 1: Prediction Markets & Settlement).

Predictions feel like social media posts — but every post references one canonical, shared-liquidity market per fixture/outcome. Settlement is trust-minimized via TxLINE's on-chain Merkle proofs on Solana.

## Stack

- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Framer Motion, React Query, Socket.IO client
- **Backend**: Next.js Route Handlers + custom Socket.IO server (`server.ts`)
- **Database**: PostgreSQL via Prisma 5 (Supabase recommended)
- **Auth**: Privy (embedded Solana wallets + external wallet linking)
- **Blockchain**: Solana Devnet, Anchor (escrow program — see Milestone 3 docs)
- **Data**: TxLINE (TxODDS) — fixtures, live scores/odds via SSE, Merkle-proof settlement

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Environment variables
Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` / `DIRECT_URL` — Supabase Postgres connection strings
- `NEXT_PUBLIC_PRIVY_APP_ID` / `PRIVY_APP_SECRET` — from the Privy dashboard
- `TXLINE_SUBSCRIPTION_KEYPAIR` — a funded Solana mainnet keypair (byte array) used to activate the free World Cup TxLINE tier
- `CALLR_PROGRAM_ID` — set after deploying the Anchor program (Milestone 3)
- `CRON_SECRET` — any random string, used to authenticate cron-triggered routes

### 3. Database
```bash
npm run db:push
npm run db:generate
```

### 4. Sync fixtures
```bash
npm run sync:fixtures
```
Fetches World Cup fixtures from TxLINE and generates canonical markets for each.

### 5. Run the dev server
```bash
npm run dev
```
Starts the custom server (`server.ts`) which boots Next.js and attaches Socket.IO to the same HTTP server, so real-time updates work locally exactly as in production.

## Architecture Notes

- **Canonical markets**: enforced via a unique constraint on `(fixtureId, marketType, outcomeValue)`. Posting always looks up an existing market — markets are never user-created.
- **Real-time pipeline**: `lib/txline/stream.ts` consumes TxLINE's SSE streams server-side; `server/socket.ts` bridges events to Socket.IO rooms (`match:{id}`, `market:{id}`, `user:{id}`, `post:{id}`).
- **Odds**: blended 70% TxLINE StablePrice / 30% internal liquidity ratio (`lib/odds.ts`), with up to a 30% late-entry penalty for post-kickoff stakes.
- **Settlement**: `lib/settlement/settle.ts` resolves outcomes from TxLINE's final score snapshot and fetches a Merkle proof via `/api/scores/stat-validation`. The on-chain CPI into `validate_stat` is implemented in Milestone 3 (`programs/callr`).

## Environment-Specific Build Notes

This project was scaffolded in a sandboxed environment with restricted network access (no access to `binaries.prisma.sh` or `fonts.googleapis.com`). As a result:
- `npx prisma generate` couldn't run here; it works normally with standard network access.
- Inter is loaded via CSS `@import` in `app/globals.css` rather than `next/font/google`, avoiding a build-time dependency on Google's font CDN.

All application code (everything outside the Prisma-generated client itself) has been fully typechecked and build-verified in this environment using a type-only Prisma client stub solely to confirm the rest of the codebase compiles cleanly.

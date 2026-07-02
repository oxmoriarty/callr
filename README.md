# Callr

Social prediction markets for World Cup football. Built for the TxODDS World Cup Hackathon (Track 1: Prediction Markets & Settlement).

Every prediction is a social post that references a canonical, shared-liquidity market. Settlement is trust-minimized via TxLINE's on-chain Merkle proofs on Solana.

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Environment variables
```bash
cp .env.example .env
```
Fill in all values. Required at minimum to run:
- `DATABASE_URL` + `DIRECT_URL` — Supabase Postgres
- `NEXT_PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET` — from https://console.privy.io
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local dev

### 3. Database
```bash
npm run db:generate   # generates Prisma client (requires internet)
npm run db:push       # pushes schema to your Supabase database
```

### 4. Start the dev server
```bash
npm run dev
```

This starts a custom Node.js server (`server.ts`) that:
- Boots Next.js 15
- Attaches Socket.IO to the same HTTP server
- Bridges TxLINE's SSE stream to connected clients in real time

Open http://localhost:3000

### 5. Sync World Cup fixtures (optional — needs TxLINE token)
```bash
npm run sync:fixtures
```

---

## Architecture

### Key rules (immutable product philosophy)
1. **Posts never own liquidity** — markets do
2. **One canonical market per outcome** — all posts for "Spain Wins" share one pool
3. **Users never create markets** — markets are generated from TxLINE fixtures
4. **Social is off-chain, financial state is on-chain**
5. **Settlement uses TxLINE Merkle proofs** — admins never decide outcomes

### Real-time data flow
```
TxLINE SSE stream → server/socket.ts → Socket.IO rooms → React clients
                                     ↓
                                 Postgres (score + odds persisted)
```

### Settlement flow
```
Match finishes → /api/settlement POST →
  lib/settlement/settle.ts →
    fetchStatValidation (TxLINE Merkle proof) →
      lib/solana/program.ts settle_market (Anchor CPI into validate_stat) →
        on-chain winner committed, positions marked WON/LOST
```

### Odds model
- Initial odds seeded from TxLINE StablePrice
- Blended 70% TxLINE / 30% internal liquidity ratio after kickoff
- Late-entry penalty: up to 30% reward reduction for 90th-minute entry
- Payout is pari-mutuel (proportional to stake share), never equal split

---

## Deploying the Anchor program

```bash
# Install Solana CLI + Anchor
# https://www.anchor-lang.com/docs/installation

anchor build           # generates target/idl/callr.json + target/types/callr.ts
anchor deploy --provider.cluster devnet

# Copy the deployed program ID into .env:
# CALLR_PROGRAM_ID="<your deployed address>"
```

---

## Production deployment (Vercel)

```bash
vercel env add DATABASE_URL
vercel env add PRIVY_APP_SECRET
# ... add all env vars from .env.example

vercel deploy
```

Configure Vercel Cron in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/sync-fixtures", "schedule": "*/30 * * * *" }
  ]
}
```

---

## Project structure

```
callr/
├── app/
│   ├── (app)/           # authenticated app pages (feed, matches, profile, wallet)
│   ├── (auth)/          # login + onboarding
│   └── api/             # Next.js route handlers
├── components/
│   ├── feed/            # PostCard, PostComposer, Feed
│   ├── match/           # MatchHeader, MarketPanel, StakeModal
│   ├── layout/          # Navbar, MobileNav, SplashScreen, Logo
│   └── ui/              # shadcn-style component primitives
├── hooks/               # useCurrentUser, useSocket, useNotifications, etc.
├── lib/
│   ├── txline/          # TxLINE auth, HTTP client, SSE stream
│   ├── solana/          # Anchor program client, PDAs, proof builder
│   └── settlement/      # Settlement engine (DB + on-chain)
├── jobs/                # sync-fixtures, generate-markets
├── server/              # Socket.IO server (attached to Next.js HTTP server)
├── programs/callr/      # Anchor Rust program
│   └── src/
│       ├── instructions/ # initialize_market, stake, lock_market, settle_market, void_market, claim
│       └── state/       # MarketEscrow, Position
├── prisma/schema.prisma # Full database schema
├── server.ts            # Custom server entry point (npm run dev)
└── middleware.ts        # Auth redirects
```

// ─── TxLINE API Types ────────────────────────────────────────────────────────

export interface TxLineFixture {
  Ts: number;
  StartTime: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
}

export interface TxLineOdds {
  FixtureId: number;
  MessageId: string;
  Ts: number;
  Bookmaker: string;
  BookmakerId: number;
  SuperOddsType: string;
  GameState?: string;
  InRunning: boolean;
  MarketParameters?: string;
  MarketPeriod?: string;
  PriceNames?: string[];
  Prices?: number[];
  Pct?: string[];
}

export interface TxLineScores {
  fixtureId: number;
  gameState: string;
  startTime: number;
  action: string;
  id: number;
  ts: number;
  seq: number;
  statusSoccerId?: Record<string, unknown>;
  scoreSoccer?: {
    Participant1: SoccerTotalScore;
    Participant2: SoccerTotalScore;
  };
  dataSoccer?: {
    Goal?: boolean;
    YellowCard?: boolean;
    RedCard?: boolean;
    Corner?: boolean;
    Minutes?: number;
    PlayerId?: number;
    Participant?: number;
  };
}

export interface SoccerScore {
  Goals: number;
  YellowCards: number;
  RedCards: number;
  Corners: number;
}

export interface SoccerTotalScore {
  H1?: SoccerScore;
  HT?: SoccerScore;
  H2?: SoccerScore;
  ET1?: SoccerScore;
  ET2?: SoccerScore;
  PE?: SoccerScore;
  Total?: SoccerScore;
}

export interface TxLineStatValidation {
  ts: number;
  statToProve: ScoreStat;
  eventStatRoot: number[];
  summary: ScoresBatchSummary;
  statProof: ProofNode[];
  subTreeProof: ProofNode[];
  mainTreeProof: ProofNode[];
  statToProve2?: ScoreStat;
  statProof2?: ProofNode[];
}

export interface ScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface ScoresBatchSummary {
  fixtureId: number;
  updateStats: {
    updateCount: number;
    minTimestamp: number;
    maxTimestamp: number;
  };
  eventStatsSubTreeRoot: number[];
}

export interface ProofNode {
  hash: number[];
  isRightSibling: boolean;
}

// ─── App Domain Types ────────────────────────────────────────────────────────

export type MarketType = 'MATCH_WINNER' | 'DRAW' | 'OVER_2_5' | 'BTTS' | 'EXACT_SCORE';
export type MarketStatus = 'OPEN' | 'LOCKED' | 'SETTLED' | 'VOID';
export type GameStatus = 'NS' | 'H1' | 'HT' | 'H2' | 'F' | 'FET' | 'FPE' | 'WET' | 'WPE' | 'ET1' | 'ET2' | 'PE' | 'I' | 'A' | 'C' | 'P';
export type PositionStatus = 'OPEN' | 'WON' | 'LOST' | 'VOID' | 'CLAIMED';
export type Side = 'support' | 'challenge';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  walletAddress?: string | null;
  createdAt: Date;
  _count: {
    posts: number;
    followers: number;
    following: number;
  };
  isFollowing?: boolean;
}

export interface FixtureWithMarkets {
  id: string;
  txlineId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  startTime: Date;
  status: GameStatus;
  homeScore: number;
  awayScore: number;
  markets: MarketSummary[];
}

export interface MarketSummary {
  id: string;
  fixtureId: string;
  marketType: MarketType;
  outcomeLabel: string;
  outcomeValue: string;
  status: MarketStatus;
  oddsImplied: number;
  supportPool: bigint;
  challengePool: bigint;
  winnerSide?: string | null;
  _count: { posts: number };
}

export interface PostWithDetails {
  id: string;
  content: string;
  side: Side;
  stakeAmount: bigint;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  market: MarketWithFixture;
  _count: {
    likes: number;
    comments: number;
    reposts: number;
  };
  isLiked?: boolean;
  isReposted?: boolean;
}

export interface MarketWithFixture extends MarketSummary {
  fixture: FixtureWithMarkets;
}

// ─── WebSocket Events ────────────────────────────────────────────────────────

export interface ScoreUpdateEvent {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  status: GameStatus;
  gameState: string;
  minute?: number;
  event?: {
    type: 'goal' | 'yellow_card' | 'red_card' | 'corner';
    team: 'home' | 'away';
    minute?: number;
  };
}

export interface OddsUpdateEvent {
  fixtureId: string;
  marketType: MarketType;
  oddsImplied: number;
  priceNames: string[];
  prices: number[];
}

export interface LiquidityUpdateEvent {
  marketId: string;
  supportPool: string; // bigint serialized as string
  challengePool: string;
  oddsImplied: number;
}

export interface NotificationEvent {
  id: string;
  type: string;
  message?: string;
  actorName?: string;
  postId?: string;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
}

// ─── Solana Types ────────────────────────────────────────────────────────────

export interface EscrowAccountData {
  marketId: string;
  supportPool: bigint;
  challengePool: bigint;
  isSettled: boolean;
  winnerSide: number; // 0=none, 1=support, 2=challenge
}

export interface PositionAccountData {
  owner: string;
  marketId: string;
  side: number; // 1=support, 2=challenge
  stake: bigint;
  entryOdds: number;
  potentialReturn: bigint;
  isClaimed: boolean;
}

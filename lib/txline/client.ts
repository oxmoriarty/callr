import axios, { AxiosInstance } from 'axios';
import { TXLINE_API_BASE } from '@/lib/constants';
import { getActiveTxlineToken, getGuestJwt } from './auth';
import type {
  TxLineFixture,
  TxLineOdds,
  TxLineScores,
  TxLineStatValidation,
} from '@/types';

function createClient(jwt: string, apiToken: string): AxiosInstance {
  return axios.create({
    baseURL: TXLINE_API_BASE,
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'X-Api-Token': apiToken,
    },
  });
}

async function getClient(): Promise<AxiosInstance> {
  const token = await getActiveTxlineToken();
  if (token) return createClient(token.jwt, token.apiToken);

  // Fallback: guest-only client for public endpoints
  const jwt = await getGuestJwt();
  return createClient(jwt, '');
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

export async function fetchFixtures(competitionId?: number): Promise<TxLineFixture[]> {
  const client = await getClient();
  const params: Record<string, unknown> = {};
  if (competitionId) params.competitionId = competitionId;
  const res = await client.get<TxLineFixture[]>('/api/fixtures/snapshot', { params });
  return res.data;
}

// ─── Odds ─────────────────────────────────────────────────────────────────────

export async function fetchOddsSnapshot(fixtureId: number): Promise<TxLineOdds[]> {
  const client = await getClient();
  const res = await client.get<TxLineOdds[]>(`/api/odds/snapshot/${fixtureId}`);
  return res.data;
}

export async function fetchLiveOdds(fixtureId: number): Promise<TxLineOdds[]> {
  const client = await getClient();
  const res = await client.get<TxLineOdds[]>(`/api/odds/updates/${fixtureId}`);
  return res.data;
}

// ─── Scores ──────────────────────────────────────────────────────────────────

export async function fetchScoresSnapshot(fixtureId: number): Promise<TxLineScores[]> {
  const client = await getClient();
  const res = await client.get<TxLineScores[]>(`/api/scores/snapshot/${fixtureId}`);
  return res.data;
}

export async function fetchHistoricalScores(fixtureId: number): Promise<TxLineScores[]> {
  const client = await getClient();
  const res = await client.get<TxLineScores[]>(`/api/scores/historical/${fixtureId}`);
  return res.data;
}

// ─── Stat Validation (for settlement) ────────────────────────────────────────

export async function fetchStatValidation(
  fixtureId: number,
  seq: number,
  statKey: number,
  statKey2?: number
): Promise<TxLineStatValidation> {
  const client = await getClient();
  const params: Record<string, unknown> = { fixtureId, seq, statKey };
  if (statKey2 !== undefined) params.statKey2 = statKey2;
  const res = await client.get<TxLineStatValidation>('/api/scores/stat-validation', { params });
  return res.data;
}

// ─── Stream URLs (for SSE) ────────────────────────────────────────────────────

export async function getStreamHeaders(): Promise<Record<string, string>> {
  const token = await getActiveTxlineToken();
  if (!token) throw new Error('No active TxLINE token');
  return {
    Authorization: `Bearer ${token.jwt}`,
    'X-Api-Token': token.apiToken,
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  };
}

export { getClient as getTxlineClient };

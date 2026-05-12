import { NextRequest, NextResponse } from 'next/server';
import type { StandingRow } from '@/types/football';

const BASE = 'https://api.football-data.org/v4';

function getHeaders() {
  return { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY ?? '' };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const league = searchParams.get('league');

  if (!league) {
    return NextResponse.json({ error: 'league es requerido' }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/competitions/${league}/standings`, {
      headers: getHeaders(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.message ?? `HTTP ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    const totalStandings = (data.standings ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.type === 'TOTAL'
    );
    const table: StandingRow[] = (totalStandings?.table ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row: any) => ({
        position: row.position,
        team: {
          id: row.team?.id ?? 0,
          name: row.team?.name ?? '',
          shortName: row.team?.shortName ?? row.team?.name ?? '',
          crest: row.team?.crest ?? '',
        },
        playedGames: row.playedGames ?? 0,
        form: row.form ?? null,
        won: row.won ?? 0,
        draw: row.draw ?? 0,
        lost: row.lost ?? 0,
        points: row.points ?? 0,
        goalsFor: row.goalsFor ?? 0,
        goalsAgainst: row.goalsAgainst ?? 0,
        goalDifference: row.goalDifference ?? 0,
      })
    );
    return NextResponse.json({ table });
  } catch {
    return NextResponse.json({ error: 'Error al obtener clasificación' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { transformFDOMatch } from '@/lib/fdo-transform';

const BASE = 'https://api.football-data.org/v4';

function getHeaders() {
  return { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY ?? '' };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const team = searchParams.get('team');

  if (!team) {
    return NextResponse.json({ error: 'team es requerido' }, { status: 400 });
  }

  try {
    // Get last 2 seasons worth of finished matches
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const dateFrom = twoYearsAgo.toISOString().split('T')[0];
    const dateTo = new Date().toISOString().split('T')[0];

    const url = `${BASE}/teams/${team}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const res = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.message ?? `HTTP ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    // Sort descending (most recent first) and limit to 20
    const matches = (data.matches ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
      .slice(0, 20)
      .map(transformFDOMatch);

    return NextResponse.json({ response: matches });
  } catch {
    return NextResponse.json({ error: 'Error al obtener forma del equipo' }, { status: 500 });
  }
}

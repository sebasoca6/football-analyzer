import { NextRequest, NextResponse } from 'next/server';
import { transformFDOMatch } from '@/lib/fdo-transform';

const BASE = 'https://api.football-data.org/v4';

function getHeaders() {
  return { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY ?? '' };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const h2h = searchParams.get('h2h'); // format: "homeId-awayId"

  if (!h2h) {
    return NextResponse.json({ error: 'h2h es requerido (ej: 64-65)' }, { status: 400 });
  }

  const [homeId, awayId] = h2h.split('-').map(Number);
  if (!homeId || !awayId) {
    return NextResponse.json({ error: 'Formato inválido. Usa: homeId-awayId' }, { status: 400 });
  }

  try {
    // Get last 6 years of matches for home team, then filter by opponent
    const sixYearsAgo = new Date();
    sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);
    const dateFrom = sixYearsAgo.toISOString().split('T')[0];
    const dateTo = new Date().toISOString().split('T')[0];

    const url = `${BASE}/teams/${homeId}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const res = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.message ?? `HTTP ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    const h2hMatches = (data.matches ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m.homeTeam?.id === awayId || m.awayTeam?.id === awayId)
      .slice(0, 20)
      .map(transformFDOMatch);

    return NextResponse.json({ response: h2hMatches });
  } catch {
    return NextResponse.json({ error: 'Error al obtener historial H2H' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { transformFDOMatch } from '@/lib/fdo-transform';

const BASE = 'https://api.football-data.org/v4';

function getHeaders() {
  return { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY ?? '' };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const league = searchParams.get('league'); // competition code e.g. "PL"
  const date = searchParams.get('date');     // YYYY-MM-DD

  if (!league || !date) {
    return NextResponse.json({ error: 'league y date son requeridos' }, { status: 400 });
  }

  try {
    const url = `${BASE}/competitions/${league}/matches?dateFrom=${date}&dateTo=${date}`;
    const res = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.message ?? `HTTP ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    const response = (data.matches ?? []).map(transformFDOMatch);
    return NextResponse.json({ response });
  } catch {
    return NextResponse.json({ error: 'Error al obtener partidos' }, { status: 500 });
  }
}

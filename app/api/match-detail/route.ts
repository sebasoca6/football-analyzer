import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://api.football-data.org/v4';

function getHeaders() {
  return { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY ?? '' };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const matchId = searchParams.get('id');

  if (!matchId) {
    return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/matches/${matchId}`, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.message ?? `HTTP ${res.status}` }, { status: res.status });
    }
    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapPlayer = (p: any) => ({
      id: p.id ?? 0,
      name: p.name ?? '',
      position: p.position ?? '',
      shirtNumber: p.shirtNumber ?? 0,
    });

    const detail = {
      id: data.id,
      status: data.status ?? '',
      homeTeam: {
        id: data.homeTeam?.id ?? 0,
        name: data.homeTeam?.name ?? '',
        formation: data.homeTeam?.formation ?? null,
        lineup: (data.homeTeam?.lineup ?? []).map(mapPlayer),
        bench: (data.homeTeam?.bench ?? []).map(mapPlayer),
        coach: data.homeTeam?.coach ? { id: data.homeTeam.coach.id ?? 0, name: data.homeTeam.coach.name ?? '' } : null,
      },
      awayTeam: {
        id: data.awayTeam?.id ?? 0,
        name: data.awayTeam?.name ?? '',
        formation: data.awayTeam?.formation ?? null,
        lineup: (data.awayTeam?.lineup ?? []).map(mapPlayer),
        bench: (data.awayTeam?.bench ?? []).map(mapPlayer),
        coach: data.awayTeam?.coach ? { id: data.awayTeam.coach.id ?? 0, name: data.awayTeam.coach.name ?? '' } : null,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      referees: (data.referees ?? []).map((r: any) => ({
        id: r.id ?? 0,
        name: r.name ?? '',
        nationality: r.nationality ?? null,
        type: r.type ?? '',
      })),
    };

    return NextResponse.json({ response: detail });
  } catch {
    return NextResponse.json({ error: 'Error al obtener detalles del partido' }, { status: 500 });
  }
}

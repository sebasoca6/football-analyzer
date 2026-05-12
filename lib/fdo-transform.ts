import type { Fixture } from '@/types/football';

function statusShort(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: 'NS',
    TIMED: 'NS',
    IN_PLAY: '1H',
    PAUSED: 'HT',
    FINISHED: 'FT',
    POSTPONED: 'PST',
    CANCELLED: 'CANC',
    SUSPENDED: 'SUSP',
    AWARDED: 'FT',
  };
  return map[status] ?? status.substring(0, 3);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformFDOMatch(m: any): Fixture {
  const winner = m.score?.winner as string | null;

  return {
    fixture: {
      id: m.id,
      referee: null,
      timezone: 'UTC',
      date: m.utcDate,
      timestamp: Math.floor(new Date(m.utcDate).getTime() / 1000),
      status: {
        long: m.status ?? '',
        short: statusShort(m.status ?? ''),
        elapsed: m.minute ?? null,
      },
      venue: { id: null, name: null, city: null },
    },
    league: {
      id: m.competition?.id ?? 0,
      name: m.competition?.name ?? '',
      country: '',
      logo: m.competition?.emblem ?? '',
      flag: '',
      season: m.season?.startDate
        ? parseInt(m.season.startDate.split('-')[0])
        : 2025,
    },
    teams: {
      home: {
        id: m.homeTeam?.id ?? 0,
        name: m.homeTeam?.shortName ?? m.homeTeam?.name ?? '',
        logo: m.homeTeam?.crest ?? '',
        winner:
          winner === 'HOME_TEAM' ? true : winner === 'AWAY_TEAM' ? false : null,
      },
      away: {
        id: m.awayTeam?.id ?? 0,
        name: m.awayTeam?.shortName ?? m.awayTeam?.name ?? '',
        logo: m.awayTeam?.crest ?? '',
        winner:
          winner === 'AWAY_TEAM' ? true : winner === 'HOME_TEAM' ? false : null,
      },
    },
    goals: {
      home: m.score?.fullTime?.home ?? null,
      away: m.score?.fullTime?.away ?? null,
    },
    score: {
      halftime: {
        home: m.score?.halfTime?.home ?? null,
        away: m.score?.halfTime?.away ?? null,
      },
      fulltime: {
        home: m.score?.fullTime?.home ?? null,
        away: m.score?.fullTime?.away ?? null,
      },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
    bookings: (m.bookings ?? []).map((b: any) => ({
      minute: b.minute ?? 0,
      team: { id: b.team?.id ?? 0, name: b.team?.name ?? '' },
      player: { id: b.player?.id ?? 0, name: b.player?.name ?? '' },
      card: b.card ?? 'YELLOW',
    })),
  };
}

export interface LeagueInfo {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string;
  season: number;
  round?: string;
}

export interface Team {
  id: number;
  name: string;
  logo: string;
  winner?: boolean | null;
}

export interface Venue {
  id: number | null;
  name: string | null;
  city: string | null;
}

export interface FixtureStatus {
  long: string;
  short: string;
  elapsed: number | null;
}

export interface Goals {
  home: number | null;
  away: number | null;
}

export interface Score {
  halftime: Goals;
  fulltime: Goals;
  extratime: Goals;
  penalty: Goals;
}

export interface Fixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    status: FixtureStatus;
    venue: Venue;
  };
  league: LeagueInfo;
  teams: {
    home: Team;
    away: Team;
  };
  goals: Goals;
  score: Score;
}

export interface FixtureStatistic {
  type: string;
  value: string | number | null;
}

export interface TeamFixtureStats {
  team: Team;
  statistics: FixtureStatistic[];
}

export interface TeamSeasonStats {
  league: LeagueInfo;
  team: Team;
  fixtures: {
    played: { home: number; away: number; total: number };
    wins: { home: number; away: number; total: number };
    draws: { home: number; away: number; total: number };
    loses: { home: number; away: number; total: number };
  };
  goals: {
    for: {
      total: { home: number; away: number; total: number };
      average: { home: string; away: string; total: string };
    };
    against: {
      total: { home: number; away: number; total: number };
      average: { home: string; away: string; total: string };
    };
  };
  clean_sheet: { home: number; away: number; total: number };
  failed_to_score: { home: number; away: number; total: number };
  cards: {
    yellow: Record<string, { total: number | null; percentage: string | null }>;
    red: Record<string, { total: number | null; percentage: string | null }>;
  };
}

export interface AnalysisStats {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  btts: number;
  over25: number;
  cleanSheets: number;
  failedToScore: number;
}

export interface Probabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  btts: number;
  noBtts: number;
  expHomeGoals: number;
  expAwayGoals: number;
}

export interface LeagueConfig {
  id: number;
  code: string;
  name: string;
  country: string;
  flag: string;
  logo: string;
}

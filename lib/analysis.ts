import type { Fixture, AnalysisStats, Probabilities, TeamSeasonStats } from '@/types/football';

export function calculateStats(
  fixtures: Fixture[],
  teamId: number,
  lastN?: number
): AnalysisStats {
  const list = lastN ? fixtures.slice(0, lastN) : fixtures;
  let wins = 0, draws = 0, losses = 0;
  let goalsScored = 0, goalsConceded = 0;
  let btts = 0, over25 = 0, cleanSheets = 0, failedToScore = 0;

  for (const f of list) {
    const isHome = f.teams.home.id === teamId;
    const scored = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
    const conceded = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);

    goalsScored += scored;
    goalsConceded += conceded;

    const winner = isHome ? f.teams.home.winner : f.teams.away.winner;
    if (winner === true) wins++;
    else if (winner === false) losses++;
    else draws++;

    if (scored > 0 && conceded > 0) btts++;
    if (scored + conceded > 2) over25++;
    if (conceded === 0) cleanSheets++;
    if (scored === 0) failedToScore++;
  }

  return {
    matches: list.length,
    wins,
    draws,
    losses,
    goalsScored,
    goalsConceded,
    btts,
    over25,
    cleanSheets,
    failedToScore,
  };
}

function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

export function calculateProbabilities(
  homeFixtures: Fixture[],
  awayFixtures: Fixture[],
  h2hFixtures: Fixture[],
  homeTeamId: number,
  awayTeamId: number
): Probabilities {
  const homeStats20 = calculateStats(homeFixtures, homeTeamId, 20);
  const awayStats20 = calculateStats(awayFixtures, awayTeamId, 20);
  const homeStats5 = calculateStats(homeFixtures, homeTeamId, 5);
  const awayStats5 = calculateStats(awayFixtures, awayTeamId, 5);

  const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 1.2);

  const homeAvgScored20 = safeDiv(homeStats20.goalsScored, homeStats20.matches);
  const homeAvgConceded20 = safeDiv(homeStats20.goalsConceded, homeStats20.matches);
  const awayAvgScored20 = safeDiv(awayStats20.goalsScored, awayStats20.matches);
  const awayAvgConceded20 = safeDiv(awayStats20.goalsConceded, awayStats20.matches);

  const homeAvgScored5 = safeDiv(homeStats5.goalsScored, homeStats5.matches);
  const homeAvgConceded5 = safeDiv(homeStats5.goalsConceded, homeStats5.matches);
  const awayAvgScored5 = safeDiv(awayStats5.goalsScored, awayStats5.matches);
  const awayAvgConceded5 = safeDiv(awayStats5.goalsConceded, awayStats5.matches);

  // Weight: 40% last 5 + 60% last 20
  const homeAvgScored = homeAvgScored20 * 0.6 + homeAvgScored5 * 0.4;
  const homeAvgConceded = homeAvgConceded20 * 0.6 + homeAvgConceded5 * 0.4;
  const awayAvgScored = awayAvgScored20 * 0.6 + awayAvgScored5 * 0.4;
  const awayAvgConceded = awayAvgConceded20 * 0.6 + awayAvgConceded5 * 0.4;

  let expHome = (homeAvgScored + awayAvgConceded) / 2;
  let expAway = (awayAvgScored + homeAvgConceded) / 2;

  // H2H adjustment (30% weight)
  if (h2hFixtures.length >= 3) {
    const h2hHome = calculateStats(h2hFixtures, homeTeamId, 10);
    const h2hAway = calculateStats(h2hFixtures, awayTeamId, 10);
    const h2hHomeScored = safeDiv(h2hHome.goalsScored, h2hHome.matches);
    const h2hAwayScored = safeDiv(h2hAway.goalsScored, h2hAway.matches);
    expHome = expHome * 0.7 + h2hHomeScored * 0.3;
    expAway = expAway * 0.7 + h2hAwayScored * 0.3;
  }

  // Home advantage boost (+10%)
  expHome *= 1.1;
  expAway *= 0.9;

  let homeWin = 0, draw = 0, awayWin = 0;
  let over25 = 0, btts = 0;

  for (let h = 0; h <= 6; h++) {
    for (let a = 0; a <= 6; a++) {
      const p = poissonPmf(expHome, h) * poissonPmf(expAway, a);
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      if (h + a > 2) over25 += p;
      if (h > 0 && a > 0) btts += p;
    }
  }

  const total = homeWin + draw + awayWin;

  return {
    homeWin: Math.round((homeWin / total) * 1000) / 10,
    draw: Math.round((draw / total) * 1000) / 10,
    awayWin: Math.round((awayWin / total) * 1000) / 10,
    over25: Math.round(over25 * 1000) / 10,
    under25: Math.round((1 - over25) * 1000) / 10,
    btts: Math.round(btts * 1000) / 10,
    noBtts: Math.round((1 - btts) * 1000) / 10,
    expHomeGoals: Math.round(expHome * 100) / 100,
    expAwayGoals: Math.round(expAway * 100) / 100,
  };
}

export function getFormString(fixtures: Fixture[], teamId: number, lastN = 5): string {
  return fixtures
    .slice(0, lastN)
    .map((f) => {
      const isHome = f.teams.home.id === teamId;
      const winner = isHome ? f.teams.home.winner : f.teams.away.winner;
      if (winner === true) return 'W';
      if (winner === false) return 'L';
      return 'D';
    })
    .join('');
}

export function getYellowCardsAvg(stats: TeamSeasonStats): number {
  let total = 0;
  for (const period of Object.values(stats.cards.yellow)) {
    total += period.total ?? 0;
  }
  const played = stats.fixtures.played.total;
  return played > 0 ? Math.round((total / played) * 10) / 10 : 0;
}

export function getScoringStreak(fixtures: Fixture[], teamId: number): number {
  let streak = 0;
  for (const f of fixtures.slice(0, 20)) {
    const isHome = f.teams.home.id === teamId;
    const scored = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
    if (scored > 0) streak++;
    else break;
  }
  return streak;
}

export function getCleanSheetStreak(fixtures: Fixture[], teamId: number): number {
  let streak = 0;
  for (const f of fixtures.slice(0, 20)) {
    const isHome = f.teams.home.id === teamId;
    const conceded = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
    if (conceded === 0) streak++;
    else break;
  }
  return streak;
}

export function getWithoutWinStreak(fixtures: Fixture[], teamId: number): number {
  let streak = 0;
  for (const f of fixtures.slice(0, 20)) {
    const isHome = f.teams.home.id === teamId;
    const winner = isHome ? f.teams.home.winner : f.teams.away.winner;
    if (winner !== true) streak++;
    else break;
  }
  return streak;
}

export type FormTrend = 'improving' | 'declining' | 'stable';

export function getFormTrend(fixtures: Fixture[], teamId: number): FormTrend {
  if (fixtures.length < 10) return 'stable';
  const pts = (s: AnalysisStats) => s.wins * 3 + s.draws;
  const recent = pts(calculateStats(fixtures, teamId, 5));
  const prev = pts(calculateStats(fixtures.slice(5), teamId, 5));
  if (recent >= prev + 3) return 'improving';
  if (recent <= prev - 3) return 'declining';
  return 'stable';
}

export interface HalfTimeStats {
  matches: number;
  htGoalsFor: number;
  htGoalsAgainst: number;
  htWins: number;
  htDraws: number;
  htLosses: number;
  stGoalsFor: number;
  stGoalsAgainst: number;
}

export function getHalfTimeStats(fixtures: Fixture[], teamId: number, n = 10): HalfTimeStats {
  const list = fixtures.slice(0, n);
  let matches = 0;
  let htGoalsFor = 0, htGoalsAgainst = 0;
  let htWins = 0, htDraws = 0, htLosses = 0;
  let stGoalsFor = 0, stGoalsAgainst = 0;

  for (const f of list) {
    const isHome = f.teams.home.id === teamId;
    const htFor = isHome ? f.score.halftime.home : f.score.halftime.away;
    const htAgainst = isHome ? f.score.halftime.away : f.score.halftime.home;
    const ftFor = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
    const ftAgainst = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
    if (htFor === null || htAgainst === null) continue;
    matches++;
    htGoalsFor += htFor;
    htGoalsAgainst += htAgainst;
    stGoalsFor += ftFor - htFor;
    stGoalsAgainst += ftAgainst - htAgainst;
    if (htFor > htAgainst) htWins++;
    else if (htFor < htAgainst) htLosses++;
    else htDraws++;
  }

  return { matches, htGoalsFor, htGoalsAgainst, htWins, htDraws, htLosses, stGoalsFor, stGoalsAgainst };
}

export function getCardsAvg(fixtures: Fixture[], teamId: number, n = 20): { yellow: number; red: number } {
  const list = fixtures.slice(0, n);
  if (list.length === 0) return { yellow: 0, red: 0 };
  let yellow = 0;
  let red = 0;
  for (const f of list) {
    if (!f.bookings) continue;
    for (const b of f.bookings) {
      if (b.team.id !== teamId) continue;
      if (b.card === 'YELLOW') yellow++;
      else if (b.card === 'RED' || b.card === 'YELLOW_RED') red++;
    }
  }
  return {
    yellow: Math.round((yellow / list.length) * 10) / 10,
    red: Math.round((red / list.length) * 10) / 10,
  };
}

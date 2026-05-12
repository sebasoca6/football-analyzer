'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { calculateStats, calculateProbabilities, getFormString, getYellowCardsAvg, getScoringStreak, getCleanSheetStreak, getWithoutWinStreak, getFormTrend, getHalfTimeStats, getCardsAvg } from '@/lib/analysis';
import { saveMatch, removeSavedMatch, isMatchSaved } from '@/lib/favorites';
import { generateNarrative } from '@/lib/narrative';
import { LEAGUES } from '@/lib/constants';
import type { Fixture, TeamSeasonStats, AnalysisStats, Probabilities, MatchDetail, StandingRow, LineupPlayer } from '@/types/football';
import StandingsTable from '@/components/StandingsTable';

type Tab = 'resumen' | 'h2h' | 'local' | 'visitante' | 'estadisticas' | 'probabilidades' | 'analisis' | 'alineaciones' | 'clasificacion';

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'alineaciones', label: '⚽ Alineaciones' },
  { id: 'h2h', label: 'H2H' },
  { id: 'local', label: 'Forma Local' },
  { id: 'visitante', label: 'Forma Visitante' },
  { id: 'estadisticas', label: 'Estadísticas' },
  { id: 'probabilidades', label: 'Probabilidades' },
  { id: 'clasificacion', label: '📊 Clasificación' },
  { id: 'analisis', label: '📝 Análisis' },
];

function FormDot({ result }: { result: 'W' | 'D' | 'L' }) {
  const cls =
    result === 'W' ? 'bg-green-500' : result === 'D' ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <span
      title={result === 'W' ? 'Victoria' : result === 'D' ? 'Empate' : 'Derrota'}
      className={`inline-block w-6 h-6 rounded-full ${cls} text-white text-xs font-bold flex items-center justify-center`}
    >
      {result}
    </span>
  );
}

function ProbBar({
  label,
  value,
  color = 'bg-green-500',
  sublabel,
}: {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-bold text-white">{value.toFixed(1)}%</span>
      </div>
      {sublabel && <p className="text-xs text-slate-500">{sublabel}</p>}
      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatRow({
  label,
  home,
  away,
  higherIsGood = true,
}: {
  label: string;
  home: number;
  away: number;
  higherIsGood?: boolean;
}) {
  const total = home + away || 1;
  const homeWidth = (home / total) * 100;
  const homeBetter = higherIsGood ? home >= away : home <= away;
  const awayBetter = higherIsGood ? away >= home : away <= home;

  return (
    <div className="space-y-1 py-2 border-b border-slate-800 last:border-0">
      <div className="flex justify-between text-sm">
        <span className={`font-semibold ${homeBetter ? 'text-green-400' : 'text-slate-300'}`}>
          {typeof home === 'number' ? home.toFixed(home % 1 === 0 ? 0 : 2) : home}
        </span>
        <span className="text-slate-400 text-xs uppercase tracking-wide">{label}</span>
        <span className={`font-semibold ${awayBetter ? 'text-green-400' : 'text-slate-300'}`}>
          {typeof away === 'number' ? away.toFixed(away % 1 === 0 ? 0 : 2) : away}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800">
        <div className="bg-blue-500 h-full" style={{ width: `${homeWidth}%` }} />
        <div className="bg-orange-500 h-full flex-1" />
      </div>
    </div>
  );
}

function FixtureRow({
  f,
  teamId,
  showLeague = false,
}: {
  f: Fixture;
  teamId: number;
  showLeague?: boolean;
}) {
  const isHome = f.teams.home.id === teamId;
  const winner = isHome ? f.teams.home.winner : f.teams.away.winner;
  const result = winner === true ? 'W' : winner === false ? 'L' : 'D';
  const scored = isHome ? f.goals.home : f.goals.away;
  const conceded = isHome ? f.goals.away : f.goals.home;
  const opponent = isHome ? f.teams.away : f.teams.home;
  const side = isHome ? 'L' : 'V';

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 text-sm">
      <td className="py-2 px-2 text-slate-500 text-xs">
        {new Date(f.fixture.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
      </td>
      <td className="py-2 px-2">
        <span
          className={`px-1.5 py-0.5 rounded text-xs font-bold ${
            side === 'L' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
          }`}
        >
          {side}
        </span>
      </td>
      <td className="py-2 px-2 flex items-center gap-1.5">
        {opponent.logo && <img src={opponent.logo} alt="" className="w-4 h-4 object-contain" />}
        <span className="text-slate-300">{opponent.name}</span>
      </td>
      {showLeague && (
        <td className="py-2 px-2 text-xs text-slate-500">{f.league.name}</td>
      )}
      <td className="py-2 px-2 text-center font-mono text-slate-200">
        {scored ?? '-'}-{conceded ?? '-'}
      </td>
      <td className="py-2 px-2 text-center">
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${
            result === 'W'
              ? 'bg-green-500/20 text-green-400'
              : result === 'D'
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {result === 'W' ? 'V' : result === 'D' ? 'E' : 'D'}
        </span>
      </td>
    </tr>
  );
}

function StatsCard({ stats, label }: { stats: AnalysisStats; label: string }) {
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  return (
    <div className="bg-[#1a2236] rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</h4>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-500/10 rounded-lg p-2">
          <p className="text-xl font-bold text-green-400">{stats.wins}</p>
          <p className="text-xs text-slate-400">Victorias</p>
        </div>
        <div className="bg-yellow-500/10 rounded-lg p-2">
          <p className="text-xl font-bold text-yellow-400">{stats.draws}</p>
          <p className="text-xs text-slate-400">Empates</p>
        </div>
        <div className="bg-red-500/10 rounded-lg p-2">
          <p className="text-xl font-bold text-red-400">{stats.losses}</p>
          <p className="text-xs text-slate-400">Derrotas</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Goles a favor</span>
          <span className="font-semibold text-white">
            {stats.matches > 0 ? (stats.goalsScored / stats.matches).toFixed(2) : '0.00'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Goles en contra</span>
          <span className="font-semibold text-white">
            {stats.matches > 0 ? (stats.goalsConceded / stats.matches).toFixed(2) : '0.00'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">BTTS</span>
          <span className="font-semibold text-white">{pct(stats.btts, stats.matches)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">+2.5 goles</span>
          <span className="font-semibold text-white">{pct(stats.over25, stats.matches)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Portería a 0</span>
          <span className="font-semibold text-white">{pct(stats.cleanSheets, stats.matches)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Sin marcar</span>
          <span className="font-semibold text-white">{pct(stats.failedToScore, stats.matches)}%</span>
        </div>
      </div>
    </div>
  );
}

function PlayerDot({ player, color }: { player: LineupPlayer; color: string }) {
  const shortName = player.name.split(' ').pop() ?? player.name;
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ minWidth: '3rem', maxWidth: '3rem' }}>
      <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white/30`}>
        {player.shirtNumber || '?'}
      </div>
      <span className="text-white text-xs text-center leading-tight w-full truncate px-0.5">
        {shortName}
      </span>
    </div>
  );
}

function H2HMatchRow({ f, perspectiveId }: { f: Fixture; perspectiveId: number }) {
  const isHome = f.teams.home.id === perspectiveId;
  const winner = isHome ? f.teams.home.winner : f.teams.away.winner;
  const result = winner === true ? 'W' : winner === false ? 'L' : 'D';
  const finished = ['FT', 'AET', 'PEN'].includes(f.fixture.status.short);
  const scheduled = f.fixture.status.short === 'NS';
  const d = new Date(f.fixture.date);
  const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
  const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20 transition-colors">
      <div className="w-14 flex-shrink-0">
        <p className="text-xs text-slate-400">{dateStr}</p>
        <p className="text-xs text-slate-600">{scheduled ? timeStr : f.fixture.status.short}</p>
      </div>
      <div className="flex-1 flex items-center gap-1 min-w-0">
        <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
          {f.teams.home.logo && <img src={f.teams.home.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />}
          <span className="text-xs text-slate-300 truncate">{f.teams.home.name}</span>
        </div>
        <div className="flex items-center gap-0.5 px-2 font-mono font-bold text-sm flex-shrink-0">
          {finished ? (
            <>
              <span className={f.teams.home.winner ? 'text-white' : 'text-slate-500'}>{f.goals.home}</span>
              <span className="text-slate-700">-</span>
              <span className={f.teams.away.winner ? 'text-white' : 'text-slate-500'}>{f.goals.away}</span>
            </>
          ) : (
            <span className="text-slate-500 text-xs">{scheduled ? 'vs' : '-'}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {f.teams.away.logo && <img src={f.teams.away.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />}
          <span className="text-xs text-slate-300 truncate">{f.teams.away.name}</span>
        </div>
      </div>
      <div className="w-5 flex-shrink-0 flex justify-center">
        {finished && (
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
            result === 'W' ? 'bg-green-500' : result === 'D' ? 'bg-slate-600' : 'bg-red-500'
          }`}>
            {result === 'W' ? 'V' : result === 'D' ? 'E' : 'D'}
          </span>
        )}
      </div>
    </div>
  );
}

function TeamFormation({ formation, lineup, color, reverse = false }: {
  formation: string | null;
  lineup: LineupPlayer[];
  color: string;
  reverse?: boolean;
}) {
  const rows: LineupPlayer[][] = [];
  if (!formation || lineup.length === 0) {
    if (lineup.length > 0) rows.push(lineup);
  } else {
    const groups = [1, ...formation.split('-').map(Number)];
    let idx = 0;
    for (const count of groups) {
      rows.push(lineup.slice(idx, idx + count));
      idx += count;
    }
  }
  const displayRows = reverse ? [...rows].reverse() : rows;
  return (
    <div className="flex flex-col justify-between h-full gap-2 py-3">
      {displayRows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1 flex-wrap">
          {row.map((p, j) => (
            <PlayerDot key={p.id || j} player={p} color={color} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [formN, setFormN] = useState<5 | 10 | 20>(10);

  const homeId = Number(sp.get('home'));
  const awayId = Number(sp.get('away'));
  const leagueId = Number(sp.get('league'));
  const season = sp.get('season') ?? '2024';
  const homeName = sp.get('homeName') ?? 'Local';
  const awayName = sp.get('awayName') ?? 'Visitante';
  const homeLogo = sp.get('homeLogo') ?? '';
  const awayLogo = sp.get('awayLogo') ?? '';
  const leagueName = sp.get('leagueName') ?? '';
  const matchDate = sp.get('date') ?? '';
  const leagueCode = LEAGUES.find(l => l.id === leagueId)?.code ?? '';

  const [homeFixtures, setHomeFixtures] = useState<Fixture[]>([]);
  const [awayFixtures, setAwayFixtures] = useState<Fixture[]>([]);
  const [h2hFixtures, setH2hFixtures] = useState<Fixture[]>([]);
  const [homeSeasonStats, setHomeSeasonStats] = useState<TeamSeasonStats | null>(null);
  const [awaySeasonStats, setAwaySeasonStats] = useState<TeamSeasonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [bookOdds, setBookOdds] = useState({ home: '', draw: '', away: '', over25: '', under25: '', btts: '', noBtts: '' });
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [h2hPage, setH2hPage] = useState(0);
  const [recentTeam, setRecentTeam] = useState<'home' | 'away'>('home');
  const [recentPage, setRecentPage] = useState(0);

  useEffect(() => {
    if (id) setSaved(isMatchSaved(Number(id)));
  }, [id]);

  const fetchData = useCallback(async () => {
    if (!homeId || !awayId || !leagueId) {
      setError('Parámetros inválidos');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const standingsPromise = leagueCode
        ? fetch(`/api/standings?league=${leagueCode}`)
        : Promise.resolve(new Response(JSON.stringify({ table: [] }), { headers: { 'Content-Type': 'application/json' } }));

      const [homeRes, awayRes, h2hRes, homeStatsRes, awayStatsRes, detailRes, standingsRes] = await Promise.all([
        fetch(`/api/team-form?team=${homeId}&season=${season}`),
        fetch(`/api/team-form?team=${awayId}&season=${season}`),
        fetch(`/api/h2h?h2h=${homeId}-${awayId}`),
        fetch(`/api/team-stats?team=${homeId}&league=${leagueId}&season=${season}`),
        fetch(`/api/team-stats?team=${awayId}&league=${leagueId}&season=${season}`),
        fetch(`/api/match-detail?id=${id}`),
        standingsPromise,
      ]);

      const [homeData, awayData, h2hData, homeStatsData, awayStatsData, detailData, standingsData] = await Promise.all([
        homeRes.json(),
        awayRes.json(),
        h2hRes.json(),
        homeStatsRes.json(),
        awayStatsRes.json(),
        detailRes.json(),
        standingsRes.json(),
      ]);

      setHomeFixtures(homeData.response ?? []);
      setAwayFixtures(awayData.response ?? []);
      setH2hFixtures(h2hData.response ?? []);
      if (homeStatsData.response) setHomeSeasonStats(homeStatsData.response);
      if (awayStatsData.response) setAwaySeasonStats(awayStatsData.response);
      if (detailData.response) setMatchDetail(detailData.response);
      if (standingsData.table) setStandings(standingsData.table);
    } catch {
      setError('Error al cargar los datos. Verifica tu conexión y API key.');
    } finally {
      setLoading(false);
    }
  }, [homeId, awayId, leagueId, season, id, leagueCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400">Analizando partido...</p>
        <p className="text-xs text-slate-600">Cargando histórico, H2H y estadísticas</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-semibold mb-2">Error</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-sm text-green-400 hover:underline"
          >
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  const homeStats = calculateStats(homeFixtures, homeId, formN);
  const awayStats = calculateStats(awayFixtures, awayId, formN);
  const homeStats5 = calculateStats(homeFixtures, homeId, 5);
  const awayStats5 = calculateStats(awayFixtures, awayId, 5);
  const homeStats10 = calculateStats(homeFixtures, homeId, 10);
  const awayStats10 = calculateStats(awayFixtures, awayId, 10);
  const homeStats20 = calculateStats(homeFixtures, homeId, 20);
  const awayStats20 = calculateStats(awayFixtures, awayId, 20);
  const h2hHomeStats = calculateStats(h2hFixtures, homeId);
  const h2hAwayStats = calculateStats(h2hFixtures, awayId);

  const probs: Probabilities =
    homeFixtures.length > 0
      ? calculateProbabilities(homeFixtures, awayFixtures, h2hFixtures, homeId, awayId)
      : { homeWin: 33.3, draw: 33.3, awayWin: 33.3, over25: 50, under25: 50, btts: 50, noBtts: 50, expHomeGoals: 1.2, expAwayGoals: 1.0 };

  const homeForm5 = getFormString(homeFixtures, homeId, 5);
  const awayForm5 = getFormString(awayFixtures, awayId, 5);

  const homeScoringStreak = getScoringStreak(homeFixtures, homeId);
  const awayScoringStreak = getScoringStreak(awayFixtures, awayId);
  const homeCSStreak = getCleanSheetStreak(homeFixtures, homeId);
  const awayCSStreak = getCleanSheetStreak(awayFixtures, awayId);
  const homeNoWinStreak = getWithoutWinStreak(homeFixtures, homeId);
  const awayNoWinStreak = getWithoutWinStreak(awayFixtures, awayId);
  const homeTrend = getFormTrend(homeFixtures, homeId);
  const awayTrend = getFormTrend(awayFixtures, awayId);
  const homeHT = getHalfTimeStats(homeFixtures, homeId, 10);
  const awayHT = getHalfTimeStats(awayFixtures, awayId, 10);
  const homeCards = getCardsAvg(homeFixtures, homeId);
  const awayCards = getCardsAvg(awayFixtures, awayId);
  const homeCards5 = getCardsAvg(homeFixtures, homeId, 5);
  const homeCards10 = getCardsAvg(homeFixtures, homeId, 10);
  const awayCards5 = getCardsAvg(awayFixtures, awayId, 5);
  const awayCards10 = getCardsAvg(awayFixtures, awayId, 10);

  const H2H_PAGE_SIZE = 5;
  const pagedH2H = h2hFixtures.slice(h2hPage * H2H_PAGE_SIZE, (h2hPage + 1) * H2H_PAGE_SIZE);
  const recentFormFixtures = recentTeam === 'home' ? homeFixtures : awayFixtures;
  const recentFormId = recentTeam === 'home' ? homeId : awayId;
  const recentFormName = recentTeam === 'home' ? homeName : awayName;
  const recentFormLogo = recentTeam === 'home' ? homeLogo : awayLogo;
  const pagedRecentForm = recentFormFixtures.slice(recentPage * H2H_PAGE_SIZE, (recentPage + 1) * H2H_PAGE_SIZE);
  let h2hNoLossStreak = 0;
  for (const f of h2hFixtures) {
    const isH = f.teams.home.id === homeId;
    const w = isH ? f.teams.home.winner : f.teams.away.winner;
    if (w !== false) h2hNoLossStreak++;
    else break;
  }
  let h2hNoCSStreak = 0;
  for (const f of h2hFixtures) {
    if ((f.goals.home ?? 0) > 0 && (f.goals.away ?? 0) > 0) h2hNoCSStreak++;
    else break;
  }
  const h2hFive = h2hFixtures.slice(0, 5);
  const h2hTen = h2hFixtures.slice(0, 10);
  const h2hBTTS10 = h2hTen.filter(f => (f.goals.home ?? 0) > 0 && (f.goals.away ?? 0) > 0).length;
  const h2hUnder25_5 = h2hFive.filter(f => (f.goals.home ?? 0) + (f.goals.away ?? 0) < 3).length;
  const h2hOver25_5 = h2hFive.filter(f => (f.goals.home ?? 0) + (f.goals.away ?? 0) > 2).length;
  const recentTenF = recentFormFixtures.slice(0, 10);
  const recentOver25_9 = recentFormFixtures.slice(0, 9).filter(f => (f.goals.home ?? 0) + (f.goals.away ?? 0) > 2).length;
  const recentBTTS_10 = recentTenF.filter(f => (f.goals.home ?? 0) > 0 && (f.goals.away ?? 0) > 0).length;
  const recentCS_10 = recentTenF.filter(f => f.teams.home.id === recentFormId ? (f.goals.away ?? 1) === 0 : (f.goals.home ?? 1) === 0).length;
  const recentNoScore_10 = recentTenF.filter(f => f.teams.home.id === recentFormId ? (f.goals.home ?? 1) === 0 : (f.goals.away ?? 1) === 0).length;

  const trendLabel = (t: ReturnType<typeof getFormTrend>) =>
    t === 'improving' ? { text: '↑ Mejorando', cls: 'text-green-400' }
    : t === 'declining' ? { text: '↓ Bajando', cls: 'text-red-400' }
    : { text: '→ Estable', cls: 'text-yellow-400' };

  const narrative = homeFixtures.length > 0 ? generateNarrative({
    homeName, awayName,
    homeStats10, awayStats10,
    homeStats5, awayStats5,
    h2hStats: h2hHomeStats,
    h2hCount: h2hFixtures.length,
    probs, homeTrend, awayTrend,
    homeScoringStreak, awayScoringStreak,
    homeCSStreak, awayCSStreak,
    homeNoWinStreak, awayNoWinStreak,
    homeHT, awayHT,
  }) : '';

  function valueColor(edge: number) {
    if (edge >= 5) return 'text-green-400 font-bold';
    if (edge >= 2) return 'text-yellow-400';
    if (edge < 0) return 'text-red-400';
    return 'text-slate-400';
  }

  const valueRows: { label: string; modelProb: number; oddsKey: keyof typeof bookOdds }[] = [
    { label: `Victoria ${homeName}`, modelProb: probs.homeWin, oddsKey: 'home' },
    { label: 'Empate', modelProb: probs.draw, oddsKey: 'draw' },
    { label: `Victoria ${awayName}`, modelProb: probs.awayWin, oddsKey: 'away' },
    { label: 'Más de 2.5 goles', modelProb: probs.over25, oddsKey: 'over25' },
    { label: 'Menos de 2.5 goles', modelProb: probs.under25, oddsKey: 'under25' },
    { label: 'BTTS Sí', modelProb: probs.btts, oddsKey: 'btts' },
    { label: 'BTTS No', modelProb: probs.noBtts, oddsKey: 'noBtts' },
  ];

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Back Button + Save */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-400 hover:text-green-400 flex items-center gap-1"
        >
          ← Volver
        </button>
        <button
          onClick={() => {
            const fid = Number(id);
            if (saved) { removeSavedMatch(fid); setSaved(false); }
            else {
              saveMatch({ fixtureId: fid, homeName, awayName, homeLogo, awayLogo, leagueName, date: matchDate, homeId, awayId, leagueId, season: Number(season) });
              setSaved(true);
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
            saved ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-yellow-500/40 hover:text-yellow-400'
          }`}
        >
          {saved ? '★ Guardado' : '☆ Guardar'}
        </button>
      </div>

      {/* Match Header */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
        <p className="text-center text-xs text-slate-500 mb-4">
          {leagueName} ·{' '}
          {matchDate
            ? new Date(matchDate).toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : ''}
        </p>
        <div className="flex items-center justify-around">
          <div className="flex flex-col items-center gap-3 flex-1">
            {homeLogo && <img src={homeLogo} alt={homeName} className="w-20 h-20 object-contain" />}
            <h2 className="text-xl font-bold text-white text-center">{homeName}</h2>
            <div className="flex gap-1">
              {homeForm5.split('').map((r, i) => (
                <FormDot key={i} result={r as 'W' | 'D' | 'L'} />
              ))}
            </div>
          </div>

          <div className="text-center px-6">
            <div className="text-4xl font-black text-slate-600">VS</div>
            <div className="mt-3 flex flex-col gap-1 text-xs text-slate-500">
              <span>⚽ Exp. Goles</span>
              <span className="text-blue-400 font-bold text-sm">
                {probs.expHomeGoals} - {probs.expAwayGoals}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 flex-1">
            {awayLogo && <img src={awayLogo} alt={awayName} className="w-20 h-20 object-contain" />}
            <h2 className="text-xl font-bold text-white text-center">{awayName}</h2>
            <div className="flex gap-1">
              {awayForm5.split('').map((r, i) => (
                <FormDot key={i} result={r as 'W' | 'D' | 'L'} />
              ))}
            </div>
          </div>
        </div>

        {/* Quick Probs */}
        <div className="grid grid-cols-3 gap-3 mt-6 text-center">
          <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20">
            <p className="text-2xl font-black text-blue-400">{probs.homeWin.toFixed(0)}%</p>
            <p className="text-xs text-slate-400 mt-1">Victoria Local</p>
          </div>
          <div className="bg-yellow-500/10 rounded-xl p-3 border border-yellow-500/20">
            <p className="text-2xl font-black text-yellow-400">{probs.draw.toFixed(0)}%</p>
            <p className="text-xs text-slate-400 mt-1">Empate</p>
          </div>
          <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
            <p className="text-2xl font-black text-orange-400">{probs.awayWin.toFixed(0)}%</p>
            <p className="text-xs text-slate-400 mt-1">Victoria Visitante</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 bg-[#111827] rounded-xl p-1 border border-slate-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'resumen' && (
        <div className="grid md:grid-cols-2 gap-4">
          <StatsCard stats={homeStats10} label={`${homeName} — Últimos 10`} />
          <StatsCard stats={awayStats10} label={`${awayName} — Últimos 10`} />

          {/* Tendencias */}
          <div className="col-span-full bg-[#1a2236] rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Tendencias y Rachas</h4>
            <div className="grid grid-cols-2 gap-6">
              {[{ name: homeName, scoring: homeScoringStreak, cs: homeCSStreak, noWin: homeNoWinStreak, trend: homeTrend, ht: homeHT },
                { name: awayName, scoring: awayScoringStreak, cs: awayCSStreak, noWin: awayNoWinStreak, trend: awayTrend, ht: awayHT }]
                .map(({ name, scoring, cs, noWin, trend, ht }) => {
                  const tl = trendLabel(trend);
                  return (
                    <div key={name} className="space-y-2 text-sm">
                      <p className="font-semibold text-slate-300 text-xs truncate">{name}</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Marcando seguido</span>
                          <span className={`font-bold ${scoring >= 5 ? 'text-green-400' : scoring >= 3 ? 'text-yellow-400' : 'text-slate-300'}`}>{scoring} partidos</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Portería a 0 seguido</span>
                          <span className={`font-bold ${cs >= 3 ? 'text-green-400' : cs >= 2 ? 'text-yellow-400' : 'text-slate-300'}`}>{cs} partidos</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Sin ganar</span>
                          <span className={`font-bold ${noWin >= 5 ? 'text-red-400' : noWin >= 3 ? 'text-yellow-400' : 'text-slate-300'}`}>{noWin} partidos</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tendencia (últ. 10)</span>
                          <span className={`font-bold ${tl.cls}`}>{tl.text}</span>
                        </div>
                        {ht.matches > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
                            <p className="text-xs text-slate-500 uppercase tracking-wide">1er Tiempo (últ. 10)</p>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Goles HT/partido</span>
                              <span className="text-white font-mono">{ht.matches > 0 ? ((ht.htGoalsFor + ht.htGoalsAgainst) / ht.matches).toFixed(1) : '-'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Ganando HT</span>
                              <span className="text-green-400">{ht.htWins}/{ht.matches}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Goles 2T</span>
                              <span className="text-blue-400">{ht.stGoalsFor} a favor / {ht.stGoalsAgainst} en contra</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {homeSeasonStats && (
            <div className="bg-[#1a2236] rounded-xl p-4 col-span-full">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                Estadísticas de Temporada
              </h4>
              <div className="space-y-1">
                <StatRow
                  label="Goles marcados/partido"
                  home={parseFloat(homeSeasonStats.goals.for.average.total)}
                  away={parseFloat(awaySeasonStats?.goals.for.average.total ?? '0')}
                />
                <StatRow
                  label="Goles recibidos/partido"
                  home={parseFloat(homeSeasonStats.goals.against.average.total)}
                  away={parseFloat(awaySeasonStats?.goals.against.average.total ?? '0')}
                  higherIsGood={false}
                />
                <StatRow
                  label="Partidos sin encajar"
                  home={homeSeasonStats.clean_sheet.total}
                  away={awaySeasonStats?.clean_sheet.total ?? 0}
                />
                <StatRow
                  label="Tarjetas amarillas/partido"
                  home={getYellowCardsAvg(homeSeasonStats)}
                  away={awaySeasonStats ? getYellowCardsAvg(awaySeasonStats) : 0}
                  higherIsGood={false}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'h2h' && (
        <div className="space-y-4">
          {/* Big score summary */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-center gap-6">
              <div className="flex flex-col items-center gap-2 flex-1">
                {homeLogo && <img src={homeLogo} alt="" className="w-14 h-14 object-contain" />}
                <span className="text-4xl font-black text-blue-400">{h2hHomeStats.wins}</span>
                <span className="text-xs text-slate-400 text-center truncate max-w-[90px]">{homeName}</span>
              </div>
              <div className="text-center flex-shrink-0">
                <span className="text-4xl font-black text-slate-500">{h2hHomeStats.draws}</span>
                <p className="text-xs text-slate-600 mt-0.5">Empates</p>
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                {awayLogo && <img src={awayLogo} alt="" className="w-14 h-14 object-contain" />}
                <span className="text-4xl font-black text-orange-400">{h2hAwayStats.wins}</span>
                <span className="text-xs text-slate-400 text-center truncate max-w-[90px]">{awayName}</span>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-3 text-xs text-slate-600">
              <span>{h2hFixtures.length} partidos totales</span>
              {h2hHomeStats.matches > 0 && (
                <><span>·</span><span>{((h2hHomeStats.goalsScored + h2hAwayStats.goalsScored) / h2hHomeStats.matches).toFixed(1)} goles/p</span></>
              )}
            </div>
          </div>

          {/* Two columns: Cara a cara + Partidos */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Cara a cara */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2.5 bg-slate-800/30 border-b border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Cara a cara</h4>
              </div>
              {h2hFixtures.length === 0 ? (
                <p className="text-center py-10 text-slate-500 text-sm">Sin historial de enfrentamientos</p>
              ) : (
                <>
                  <div>
                    {pagedH2H.map((f) => (
                      <H2HMatchRow key={f.fixture.id} f={f} perspectiveId={homeId} />
                    ))}
                  </div>
                  {h2hFixtures.length > H2H_PAGE_SIZE && (
                    <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800 text-xs">
                      <button
                        onClick={() => setH2hPage(p => p - 1)}
                        disabled={h2hPage === 0}
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-green-400 disabled:opacity-30 text-lg"
                      >‹</button>
                      <span className="text-slate-500">
                        {h2hPage * H2H_PAGE_SIZE + 1}–{Math.min((h2hPage + 1) * H2H_PAGE_SIZE, h2hFixtures.length)} de {h2hFixtures.length}
                      </span>
                      <button
                        onClick={() => setH2hPage(p => p + 1)}
                        disabled={(h2hPage + 1) * H2H_PAGE_SIZE >= h2hFixtures.length}
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-green-400 disabled:opacity-30 text-lg"
                      >›</button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Partidos */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-slate-800/30 border-b border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Partidos</h4>
                <div className="flex gap-1.5">
                  {([['home', homeName, homeLogo], ['away', awayName, awayLogo]] as [string, string, string][]).map(([team, name, logo]) => (
                    <button
                      key={team}
                      onClick={() => { setRecentTeam(team as 'home' | 'away'); setRecentPage(0); }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        recentTeam === team
                          ? 'bg-green-500/20 border-green-500/40 text-green-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {logo && <img src={logo} alt="" className="w-4 h-4 object-contain" />}
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                {pagedRecentForm.map((f) => (
                  <H2HMatchRow key={f.fixture.id} f={f} perspectiveId={recentFormId} />
                ))}
              </div>
              {recentFormFixtures.length > H2H_PAGE_SIZE && (
                <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800 text-xs">
                  <button
                    onClick={() => setRecentPage(p => p - 1)}
                    disabled={recentPage === 0}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-green-400 disabled:opacity-30 text-lg"
                  >‹</button>
                  <span className="text-slate-500">
                    {recentPage * H2H_PAGE_SIZE + 1}–{Math.min((recentPage + 1) * H2H_PAGE_SIZE, recentFormFixtures.length)} de {recentFormFixtures.length}
                  </span>
                  <button
                    onClick={() => setRecentPage(p => p + 1)}
                    disabled={(recentPage + 1) * H2H_PAGE_SIZE >= recentFormFixtures.length}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-green-400 disabled:opacity-30 text-lg"
                  >›</button>
                </div>
              )}
            </div>
          </div>

          {/* Rachas */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Rachas de cara a cara */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2.5 bg-slate-800/30 border-b border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Rachas de cara a cara</h4>
              </div>
              <div className="divide-y divide-slate-800/50">
                {[
                  { logo: homeLogo, label: `Sin derrotas (${homeName.split(' ')[0]})`, value: String(h2hNoLossStreak) },
                  { logo: null, label: 'Sin portería a cero (ambos)', value: String(h2hNoCSStreak) },
                  { logo: null, label: 'Ambos marcan (últ. 10)', value: `${h2hBTTS10}/10` },
                  { logo: null, label: 'Menos de 2.5 goles (últ. 5)', value: `${h2hUnder25_5}/5` },
                  { logo: null, label: 'Más de 2.5 goles (últ. 5)', value: `${h2hOver25_5}/5` },
                  { logo: null, label: 'Goles por partido', value: h2hHomeStats.matches > 0 ? ((h2hHomeStats.goalsScored + h2hAwayStats.goalsScored) / h2hHomeStats.matches).toFixed(1) : '—' },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {r.logo
                        ? <img src={r.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
                        : <span className="w-4 flex-shrink-0" />
                      }
                      <span className="text-sm text-slate-300">{r.label}</span>
                    </div>
                    <span className="font-bold text-white ml-2">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rachas recientes */}
            <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2.5 bg-slate-800/30 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Rachas recientes</h4>
                <div className="flex items-center gap-1">
                  {recentFormLogo && <img src={recentFormLogo} alt="" className="w-4 h-4 object-contain" />}
                  <span className="text-xs text-slate-400">{recentFormName}</span>
                </div>
              </div>
              <div className="divide-y divide-slate-800/50">
                {[
                  { label: 'Más de 2.5 goles (últ. 9)', value: `${recentOver25_9}/9` },
                  { label: 'BTTS — ambos marcan (últ. 10)', value: `${recentBTTS_10}/10` },
                  { label: 'Portería a 0 (últ. 10)', value: `${recentCS_10}/10` },
                  { label: 'Sin marcar (últ. 10)', value: `${recentNoScore_10}/10` },
                  { label: '🟨 Amarillas/partido (últ. 20)', value: `${getCardsAvg(recentFormFixtures, recentFormId).yellow.toFixed(1)}/p` },
                  { label: '🟥 Rojas/partido (últ. 20)', value: `${getCardsAvg(recentFormFixtures, recentFormId).red.toFixed(2)}/p` },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-slate-300">{r.label}</span>
                    <span className="font-bold text-white">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'local' || activeTab === 'visitante') && (
        <div className="space-y-4">
          {/* Form Toggle */}
          <div className="flex gap-2">
            {([5, 10, 20] as const).map((n) => (
              <button
                key={n}
                onClick={() => setFormN(n)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  formN === n
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-[#111827] border border-slate-700 text-slate-400'
                }`}
              >
                Últimos {n}
              </button>
            ))}
          </div>

          {activeTab === 'local' ? (
            <>
              <StatsCard stats={homeStats} label={`${homeName} — Últimos ${formN} partidos`} />
              <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-800/50 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="py-2 px-2 text-left">Fecha</th>
                      <th className="py-2 px-2 text-left">L/V</th>
                      <th className="py-2 px-2 text-left">Rival</th>
                      <th className="py-2 px-2 text-center">Res.</th>
                      <th className="py-2 px-2 text-center">R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {homeFixtures.slice(0, formN).map((f) => (
                      <FixtureRow key={f.fixture.id} f={f} teamId={homeId} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <StatsCard stats={awayStats} label={`${awayName} — Últimos ${formN} partidos`} />
              <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-800/50 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="py-2 px-2 text-left">Fecha</th>
                      <th className="py-2 px-2 text-left">L/V</th>
                      <th className="py-2 px-2 text-left">Rival</th>
                      <th className="py-2 px-2 text-center">Res.</th>
                      <th className="py-2 px-2 text-center">R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awayFixtures.slice(0, formN).map((f) => (
                      <FixtureRow key={f.fixture.id} f={f} teamId={awayId} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'estadisticas' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            {([5, 10, 20] as const).map((n) => (
              <button
                key={n}
                onClick={() => setFormN(n)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  formN === n
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-[#111827] border border-slate-700 text-slate-400'
                }`}
              >
                Últimos {n}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-sm mb-2">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              <span className="text-slate-400">{homeName}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
              <span className="text-slate-400">{awayName}</span>
            </span>
          </div>

          <div className="bg-[#111827] rounded-xl border border-slate-800 p-4 space-y-1">
            <StatRow
              label="Goles marcados/partido"
              home={homeStats.matches > 0 ? homeStats.goalsScored / homeStats.matches : 0}
              away={awayStats.matches > 0 ? awayStats.goalsScored / awayStats.matches : 0}
            />
            <StatRow
              label="Goles recibidos/partido"
              home={homeStats.matches > 0 ? homeStats.goalsConceded / homeStats.matches : 0}
              away={awayStats.matches > 0 ? awayStats.goalsConceded / awayStats.matches : 0}
              higherIsGood={false}
            />
            <StatRow
              label="% BTTS (ambos marcan)"
              home={pct(homeStats.btts, homeStats.matches)}
              away={pct(awayStats.btts, awayStats.matches)}
            />
            <StatRow
              label="% +2.5 goles"
              home={pct(homeStats.over25, homeStats.matches)}
              away={pct(awayStats.over25, awayStats.matches)}
            />
            <StatRow
              label="% Portería a 0"
              home={pct(homeStats.cleanSheets, homeStats.matches)}
              away={pct(awayStats.cleanSheets, awayStats.matches)}
            />
            <StatRow
              label="% Sin marcar"
              home={pct(homeStats.failedToScore, homeStats.matches)}
              away={pct(awayStats.failedToScore, awayStats.matches)}
              higherIsGood={false}
            />
            <StatRow
              label="Victorias"
              home={pct(homeStats.wins, homeStats.matches)}
              away={pct(awayStats.wins, awayStats.matches)}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {[
              { label: 'Últimos 5', homeS: homeStats5, awayS: awayStats5 },
              { label: 'Últimos 10', homeS: homeStats10, awayS: awayStats10 },
              { label: 'Últimos 20', homeS: homeStats20, awayS: awayStats20 },
            ].map(({ label, homeS, awayS }) => (
              <div key={label} className="bg-[#1a2236] rounded-xl p-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{label}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-400">{homeS.wins}V {homeS.draws}E {homeS.losses}D</span>
                    <span className="text-orange-400">{awayS.wins}V {awayS.draws}E {awayS.losses}D</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>GA: {homeS.goalsScored} / GC: {homeS.goalsConceded}</span>
                    <span>GA: {awayS.goalsScored} / GC: {awayS.goalsConceded}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">BTTS: {pct(homeS.btts, homeS.matches)}%</span>
                    <span className="text-slate-300">BTTS: {pct(awayS.btts, awayS.matches)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">+2.5: {pct(homeS.over25, homeS.matches)}%</span>
                    <span className="text-slate-300">+2.5: {pct(awayS.over25, awayS.matches)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Comparison Panel */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowComparison(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-lg">📊</span>
                <span className="font-semibold text-white text-sm">Comparativa Detallada</span>
                <span className="text-xs text-slate-500 ml-1">Temporada · Últ.10 · Últ.5</span>
              </div>
              <span className="text-slate-400 text-lg">{showComparison ? '▲' : '▼'}</span>
            </button>

            {showComparison && (
              <div className="border-t border-slate-800 overflow-x-auto">
                <table className="w-full text-xs min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-800/60">
                      <th className="py-3 px-3 text-left text-slate-400 font-medium w-36">Estadística</th>
                      <th colSpan={3} className="py-3 px-2 text-center text-blue-400 font-semibold border-r border-slate-700">
                        {homeName}
                      </th>
                      <th colSpan={3} className="py-3 px-2 text-center text-orange-400 font-semibold">
                        {awayName}
                      </th>
                    </tr>
                    <tr className="bg-slate-800/30 border-b border-slate-700">
                      <th className="py-2 px-3 text-left text-slate-500"></th>
                      <th className="py-2 px-2 text-center text-slate-400 font-normal">Temp.</th>
                      <th className="py-2 px-2 text-center text-slate-400 font-normal">Últ.10</th>
                      <th className="py-2 px-2 text-center text-slate-400 font-normal border-r border-slate-700">Últ.5</th>
                      <th className="py-2 px-2 text-center text-slate-400 font-normal">Temp.</th>
                      <th className="py-2 px-2 text-center text-slate-400 font-normal">Últ.10</th>
                      <th className="py-2 px-2 text-center text-slate-400 font-normal">Últ.5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label: '⚽ Goles marc./p',
                        hT: homeStats20.matches > 0 ? (homeStats20.goalsScored / homeStats20.matches).toFixed(2) : '—',
                        h10: homeStats10.matches > 0 ? (homeStats10.goalsScored / homeStats10.matches).toFixed(2) : '—',
                        h5: homeStats5.matches > 0 ? (homeStats5.goalsScored / homeStats5.matches).toFixed(2) : '—',
                        aT: awayStats20.matches > 0 ? (awayStats20.goalsScored / awayStats20.matches).toFixed(2) : '—',
                        a10: awayStats10.matches > 0 ? (awayStats10.goalsScored / awayStats10.matches).toFixed(2) : '—',
                        a5: awayStats5.matches > 0 ? (awayStats5.goalsScored / awayStats5.matches).toFixed(2) : '—',
                        higherIsGood: true,
                      },
                      {
                        label: '🛡 Goles enc./p',
                        hT: homeStats20.matches > 0 ? (homeStats20.goalsConceded / homeStats20.matches).toFixed(2) : '—',
                        h10: homeStats10.matches > 0 ? (homeStats10.goalsConceded / homeStats10.matches).toFixed(2) : '—',
                        h5: homeStats5.matches > 0 ? (homeStats5.goalsConceded / homeStats5.matches).toFixed(2) : '—',
                        aT: awayStats20.matches > 0 ? (awayStats20.goalsConceded / awayStats20.matches).toFixed(2) : '—',
                        a10: awayStats10.matches > 0 ? (awayStats10.goalsConceded / awayStats10.matches).toFixed(2) : '—',
                        a5: awayStats5.matches > 0 ? (awayStats5.goalsConceded / awayStats5.matches).toFixed(2) : '—',
                        higherIsGood: false,
                      },
                      {
                        label: '🔁 BTTS %',
                        hT: `${pct(homeStats20.btts, homeStats20.matches)}%`,
                        h10: `${pct(homeStats10.btts, homeStats10.matches)}%`,
                        h5: `${pct(homeStats5.btts, homeStats5.matches)}%`,
                        aT: `${pct(awayStats20.btts, awayStats20.matches)}%`,
                        a10: `${pct(awayStats10.btts, awayStats10.matches)}%`,
                        a5: `${pct(awayStats5.btts, awayStats5.matches)}%`,
                        higherIsGood: true,
                      },
                      {
                        label: '📈 +2.5 goles %',
                        hT: `${pct(homeStats20.over25, homeStats20.matches)}%`,
                        h10: `${pct(homeStats10.over25, homeStats10.matches)}%`,
                        h5: `${pct(homeStats5.over25, homeStats5.matches)}%`,
                        aT: `${pct(awayStats20.over25, awayStats20.matches)}%`,
                        a10: `${pct(awayStats10.over25, awayStats10.matches)}%`,
                        a5: `${pct(awayStats5.over25, awayStats5.matches)}%`,
                        higherIsGood: true,
                      },
                      {
                        label: '🧤 Portería a 0%',
                        hT: `${pct(homeStats20.cleanSheets, homeStats20.matches)}%`,
                        h10: `${pct(homeStats10.cleanSheets, homeStats10.matches)}%`,
                        h5: `${pct(homeStats5.cleanSheets, homeStats5.matches)}%`,
                        aT: `${pct(awayStats20.cleanSheets, awayStats20.matches)}%`,
                        a10: `${pct(awayStats10.cleanSheets, awayStats10.matches)}%`,
                        a5: `${pct(awayStats5.cleanSheets, awayStats5.matches)}%`,
                        higherIsGood: true,
                      },
                      {
                        label: '❌ Sin marcar %',
                        hT: `${pct(homeStats20.failedToScore, homeStats20.matches)}%`,
                        h10: `${pct(homeStats10.failedToScore, homeStats10.matches)}%`,
                        h5: `${pct(homeStats5.failedToScore, homeStats5.matches)}%`,
                        aT: `${pct(awayStats20.failedToScore, awayStats20.matches)}%`,
                        a10: `${pct(awayStats10.failedToScore, awayStats10.matches)}%`,
                        a5: `${pct(awayStats5.failedToScore, awayStats5.matches)}%`,
                        higherIsGood: false,
                      },
                      {
                        label: '🏆 Victorias %',
                        hT: `${pct(homeStats20.wins, homeStats20.matches)}%`,
                        h10: `${pct(homeStats10.wins, homeStats10.matches)}%`,
                        h5: `${pct(homeStats5.wins, homeStats5.matches)}%`,
                        aT: `${pct(awayStats20.wins, awayStats20.matches)}%`,
                        a10: `${pct(awayStats10.wins, awayStats10.matches)}%`,
                        a5: `${pct(awayStats5.wins, awayStats5.matches)}%`,
                        higherIsGood: true,
                      },
                      {
                        label: '🟨 Amarillas/p',
                        hT: homeCards.yellow.toFixed(1),
                        h10: homeCards10.yellow.toFixed(1),
                        h5: homeCards5.yellow.toFixed(1),
                        aT: awayCards.yellow.toFixed(1),
                        a10: awayCards10.yellow.toFixed(1),
                        a5: awayCards5.yellow.toFixed(1),
                        higherIsGood: false,
                      },
                      {
                        label: '🟥 Rojas/partido',
                        hT: homeCards.red.toFixed(2),
                        h10: homeCards10.red.toFixed(2),
                        h5: homeCards5.red.toFixed(2),
                        aT: awayCards.red.toFixed(2),
                        a10: awayCards10.red.toFixed(2),
                        a5: awayCards5.red.toFixed(2),
                        higherIsGood: false,
                      },
                      {
                        label: '⚑ Córners/p',
                        hT: 'N/D', h10: 'N/D', h5: 'N/D',
                        aT: 'N/D', a10: 'N/D', a5: 'N/D',
                        higherIsGood: true,
                      },
                    ].map((row, i) => {
                      const hVals = [row.hT, row.h10, row.h5];
                      const aVals = [row.aT, row.a10, row.a5];
                      return (
                        <tr key={i} className={`border-b border-slate-800/50 ${i % 2 === 0 ? 'bg-slate-900/20' : ''}`}>
                          <td className="py-2.5 px-3 text-slate-400 font-medium whitespace-nowrap">{row.label}</td>
                          {hVals.map((v, j) => (
                            <td key={j} className={`py-2.5 px-2 text-center font-mono ${j === 2 ? 'border-r border-slate-700' : ''} ${
                              v === 'N/D' ? 'text-slate-600' : 'text-blue-300'
                            }`}>{v}</td>
                          ))}
                          {aVals.map((v, j) => (
                            <td key={j} className={`py-2.5 px-2 text-center font-mono ${
                              v === 'N/D' ? 'text-slate-600' : 'text-orange-300'
                            }`}>{v}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-slate-600 px-4 py-2">⚑ Córners no disponibles en el plan gratuito de football-data.org · Temp. = últimos 20 partidos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'probabilidades' && (
        <div className="space-y-6">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-1">Goles esperados</h3>
            <p className="text-xs text-slate-500 mb-4">
              Modelo de Poisson basado en últimos 20 partidos + ajuste H2H (70%/30%)
            </p>
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div className="bg-blue-500/10 rounded-xl p-4">
                <p className="text-3xl font-black text-blue-400">{probs.expHomeGoals}</p>
                <p className="text-xs text-slate-400 mt-1">Goles esperados {homeName}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <p className="text-lg font-black text-slate-400">vs</p>
              </div>
              <div className="bg-orange-500/10 rounded-xl p-4">
                <p className="text-3xl font-black text-orange-400">{probs.expAwayGoals}</p>
                <p className="text-xs text-slate-400 mt-1">Goles esperados {awayName}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-300">Resultado del partido (1X2)</h4>
              <ProbBar label={`Victoria ${homeName}`} value={probs.homeWin} color="bg-blue-500" />
              <ProbBar label="Empate" value={probs.draw} color="bg-yellow-500" />
              <ProbBar label={`Victoria ${awayName}`} value={probs.awayWin} color="bg-orange-500" />
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-white">Mercados de Goles</h3>
            <ProbBar label="Más de 2.5 goles" value={probs.over25} color="bg-green-500"
              sublabel={`Últimas ${formN}: Local ${pct(homeStats.over25, homeStats.matches)}% · Visitante ${pct(awayStats.over25, awayStats.matches)}%`}
            />
            <ProbBar label="Menos de 2.5 goles" value={probs.under25} color="bg-slate-500" />
            <ProbBar label="Ambos marcan (BTTS Sí)" value={probs.btts} color="bg-purple-500"
              sublabel={`Últimas ${formN}: Local ${pct(homeStats.btts, homeStats.matches)}% · Visitante ${pct(awayStats.btts, awayStats.matches)}%`}
            />
            <ProbBar label="BTTS No" value={probs.noBtts} color="bg-slate-600" />
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4">Resumen de Mercados Clave</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: '1 (Local)', value: probs.homeWin, good: probs.homeWin > 50 },
                { label: 'X (Empate)', value: probs.draw, good: probs.draw > 30 },
                { label: '2 (Visitante)', value: probs.awayWin, good: probs.awayWin > 40 },
                { label: '+2.5 Goles', value: probs.over25, good: probs.over25 > 55 },
                { label: 'BTTS Sí', value: probs.btts, good: probs.btts > 55 },
                { label: '-2.5 Goles', value: probs.under25, good: probs.under25 > 55 },
              ].map((m) => (
                <div
                  key={m.label}
                  className={`rounded-xl p-3 text-center border ${
                    m.good
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-slate-800/50 border-slate-700'
                  }`}
                >
                  <p className={`text-xl font-black ${m.good ? 'text-green-400' : 'text-slate-300'}`}>
                    {m.value.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Value Betting Calculator */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-1">Calculadora de Valor vs Casas</h3>
            <p className="text-xs text-slate-500 mb-4">Introduce las cuotas decimales de las casas de apuestas para detectar value</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <th className="py-2 text-left">Mercado</th>
                    <th className="py-2 text-center">Cuota Casa</th>
                    <th className="py-2 text-center">Prob. Impl.</th>
                    <th className="py-2 text-center">Prob. Modelo</th>
                    <th className="py-2 text-center">Margen Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {valueRows.map(({ label, modelProb, oddsKey }) => {
                    const oddsVal = parseFloat(bookOdds[oddsKey]);
                    const impliedProb = !isNaN(oddsVal) && oddsVal > 1 ? (1 / oddsVal) * 100 : null;
                    const edge = impliedProb !== null ? modelProb - impliedProb : null;
                    return (
                      <tr key={oddsKey} className="border-b border-slate-800/50">
                        <td className="py-2.5 text-slate-300 pr-4">{label}</td>
                        <td className="py-2.5 text-center">
                          <input
                            type="number"
                            min="1.01"
                            step="0.01"
                            placeholder="ej: 2.10"
                            value={bookOdds[oddsKey]}
                            onChange={(e) => setBookOdds(prev => ({ ...prev, [oddsKey]: e.target.value }))}
                            className="w-20 bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-green-500"
                          />
                        </td>
                        <td className="py-2.5 text-center text-slate-400">
                          {impliedProb !== null ? `${impliedProb.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2.5 text-center text-blue-400 font-semibold">
                          {modelProb.toFixed(1)}%
                        </td>
                        <td className="py-2.5 text-center">
                          {edge !== null ? (
                            <span className={`font-bold ${valueColor(edge)}`}>
                              {edge >= 0 ? '+' : ''}{edge.toFixed(1)}%
                              {edge >= 5 ? ' ✅' : edge >= 2 ? ' 🟡' : edge < 0 ? ' ❌' : ''}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-600 mt-3">✅ Valor positivo claro (&gt;5%) · 🟡 Ligero valor (&gt;2%) · ❌ Sin valor (cuota baja respecto al modelo)</p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-xs text-yellow-200/70">
            ⚠️ <strong>Aviso:</strong> Las probabilidades son estimaciones estadísticas basadas en datos históricos. 
            No constituyen asesoramiento de apuestas. Los resultados deportivos son impredecibles.
          </div>
        </div>
      )}

      {activeTab === 'alineaciones' && (
        <div className="space-y-4">
          {matchDetail ? (
            <>
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {homeLogo && <img src={homeLogo} alt="" className="w-6 h-6 object-contain" />}
                    <div>
                      <p className="text-sm font-bold text-blue-300">{homeName}</p>
                      <p className="text-xs text-slate-500">{matchDetail.homeTeam.formation ?? 'N/D'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">Formación</p>
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <p className="text-sm font-bold text-orange-300">{awayName}</p>
                      <p className="text-xs text-slate-500">{matchDetail.awayTeam.formation ?? 'N/D'}</p>
                    </div>
                    {awayLogo && <img src={awayLogo} alt="" className="w-6 h-6 object-contain" />}
                  </div>
                </div>
                {(matchDetail.homeTeam.lineup.length > 0 || matchDetail.awayTeam.lineup.length > 0) ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/10" style={{ background: 'linear-gradient(180deg, #1a5c2e 0%, #2d7a46 50%, #1a5c2e 100%)' }}>
                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-white/20" />
                    <div className="relative flex" style={{ minHeight: 420 }}>
                      <div className="flex-1 border-r border-white/10 px-1">
                        <TeamFormation formation={matchDetail.homeTeam.formation} lineup={matchDetail.homeTeam.lineup} color="bg-blue-600" />
                      </div>
                      <div className="flex-1 px-1">
                        <TeamFormation formation={matchDetail.awayTeam.formation} lineup={matchDetail.awayTeam.lineup} color="bg-red-600" reverse />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                    <p className="text-2xl mb-2">⚽</p>
                    <p>Alineaciones no disponibles aún</p>
                    <p className="text-xs mt-1">Se publican aproximadamente 1h antes del partido</p>
                  </div>
                )}
              </div>

              {matchDetail.referees.filter(r => r.type === 'REFEREE').length > 0 && (
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Árbitro</h4>
                  {matchDetail.referees.filter(r => r.type === 'REFEREE').map((ref) => (
                    <div key={ref.id} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">{ref.name}</p>
                        {ref.nationality && <p className="text-xs text-slate-500">{ref.nationality}</p>}
                      </div>
                      <div className="flex gap-4 text-center text-xs">
                        <div>
                          <p className="text-yellow-400 font-bold text-base">{homeCards.yellow.toFixed(1)}</p>
                          <p className="text-slate-500">🟨 {homeName.split(' ')[0]}</p>
                        </div>
                        <div>
                          <p className="text-red-400 font-bold text-base">{homeCards.red.toFixed(1)}</p>
                          <p className="text-slate-500">🟥 {homeName.split(' ')[0]}</p>
                        </div>
                        <div className="w-px bg-slate-700" />
                        <div>
                          <p className="text-yellow-400 font-bold text-base">{awayCards.yellow.toFixed(1)}</p>
                          <p className="text-slate-500">🟨 {awayName.split(' ')[0]}</p>
                        </div>
                        <div>
                          <p className="text-red-400 font-bold text-base">{awayCards.red.toFixed(1)}</p>
                          <p className="text-slate-500">🟥 {awayName.split(' ')[0]}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-slate-600 mt-3">Tarjetas promedio/partido de cada equipo (últimos 20 partidos)</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { teamName: homeName, logo: homeLogo, isHome: true, detail: matchDetail.homeTeam },
                  { teamName: awayName, logo: awayLogo, isHome: false, detail: matchDetail.awayTeam },
                ].map(({ teamName, logo, isHome, detail }) => (
                  <div key={teamName} className="bg-[#1a2236] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      {logo && <img src={logo} alt="" className="w-5 h-5 object-contain" />}
                      <h4 className="text-sm font-bold text-slate-300">{teamName}</h4>
                    </div>
                    {detail.coach && (
                      <div className="text-sm">
                        <span className="text-slate-500">Entrenador: </span>
                        <span className="text-white font-medium">{detail.coach.name}</span>
                      </div>
                    )}
                    {detail.bench.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Suplentes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.bench.map((p) => (
                            <span key={p.id} className={`px-2 py-0.5 rounded text-xs ${isHome ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' : 'bg-orange-500/10 text-orange-300 border border-orange-500/20'}`}>
                              {p.shirtNumber} {p.name.split(' ').pop()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <p>Cargando detalles del partido...</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'clasificacion' && (
        <div className="space-y-4">
          {standings.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>Clasificación no disponible</p>
            </div>
          ) : (
            <div className="bg-[#111827] border border-slate-800 rounded-xl">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-sm font-semibold text-slate-300">{leagueName}</p>
              </div>
              <StandingsTable standings={standings} homeTeamId={homeId} awayTeamId={awayId} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'analisis' && (
        <div className="space-y-4">
          {!narrative ? (
            <div className="text-center py-12 text-slate-500">
              <p>No hay suficientes datos para generar el análisis.</p>
            </div>
          ) : (
            <>
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">📝</span>
                  <h3 className="font-semibold text-white">Análisis del partido</h3>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full ml-auto">Generado por IA estadística</span>
                </div>
                <div className="space-y-4">
                  {narrative.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-slate-300 text-sm leading-relaxed">{paragraph}</p>
                  ))}
                </div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-xs text-yellow-200/70">
                ⚠️ <strong>Aviso:</strong> Este análisis es una estimación estadística automática basada en datos históricos. No constituye asesoramiento de apuestas.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

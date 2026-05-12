'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { calculateStats, calculateProbabilities, getFormString, getYellowCardsAvg, getScoringStreak, getCleanSheetStreak, getWithoutWinStreak, getFormTrend, getHalfTimeStats } from '@/lib/analysis';
import { saveMatch, removeSavedMatch, isMatchSaved } from '@/lib/favorites';
import { generateNarrative } from '@/lib/narrative';
import type { Fixture, TeamSeasonStats, AnalysisStats, Probabilities } from '@/types/football';

type Tab = 'resumen' | 'h2h' | 'local' | 'visitante' | 'estadisticas' | 'probabilidades' | 'analisis';

const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'h2h', label: 'H2H' },
  { id: 'local', label: 'Forma Local' },
  { id: 'visitante', label: 'Forma Visitante' },
  { id: 'estadisticas', label: 'Estadísticas' },
  { id: 'probabilidades', label: 'Probabilidades' },
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

  const [homeFixtures, setHomeFixtures] = useState<Fixture[]>([]);
  const [awayFixtures, setAwayFixtures] = useState<Fixture[]>([]);
  const [h2hFixtures, setH2hFixtures] = useState<Fixture[]>([]);
  const [homeSeasonStats, setHomeSeasonStats] = useState<TeamSeasonStats | null>(null);
  const [awaySeasonStats, setAwaySeasonStats] = useState<TeamSeasonStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [bookOdds, setBookOdds] = useState({ home: '', draw: '', away: '', over25: '', under25: '', btts: '', noBtts: '' });

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
      const [homeRes, awayRes, h2hRes, homeStatsRes, awayStatsRes] = await Promise.all([
        fetch(`/api/team-form?team=${homeId}&season=${season}`),
        fetch(`/api/team-form?team=${awayId}&season=${season}`),
        fetch(`/api/h2h?h2h=${homeId}-${awayId}`),
        fetch(`/api/team-stats?team=${homeId}&league=${leagueId}&season=${season}`),
        fetch(`/api/team-stats?team=${awayId}&league=${leagueId}&season=${season}`),
      ]);

      const [homeData, awayData, h2hData, homeStatsData, awayStatsData] = await Promise.all([
        homeRes.json(),
        awayRes.json(),
        h2hRes.json(),
        homeStatsRes.json(),
        awayStatsRes.json(),
      ]);

      setHomeFixtures(homeData.response ?? []);
      setAwayFixtures(awayData.response ?? []);
      setH2hFixtures(h2hData.response ?? []);
      if (homeStatsData.response) setHomeSeasonStats(homeStatsData.response);
      if (awayStatsData.response) setAwaySeasonStats(awayStatsData.response);
    } catch {
      setError('Error al cargar los datos. Verifica tu conexión y API key.');
    } finally {
      setLoading(false);
    }
  }, [homeId, awayId, leagueId, season]);

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
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
              <p className="text-3xl font-black text-blue-400">{h2hHomeStats.wins}</p>
              <p className="text-sm text-slate-400 mt-1">{homeName}</p>
            </div>
            <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
              <p className="text-3xl font-black text-yellow-400">{h2hHomeStats.draws}</p>
              <p className="text-sm text-slate-400 mt-1">Empates</p>
            </div>
            <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20">
              <p className="text-3xl font-black text-orange-400">{h2hAwayStats.wins}</p>
              <p className="text-sm text-slate-400 mt-1">{awayName}</p>
            </div>
          </div>

          <div className="bg-[#1a2236] rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
            <div>
              <p className="text-white font-bold">
                {h2hHomeStats.matches > 0
                  ? ((h2hHomeStats.goalsScored + h2hAwayStats.goalsScored) / h2hHomeStats.matches).toFixed(2)
                  : '-'}
              </p>
              <p className="text-slate-400 text-xs">Goles/partido</p>
            </div>
            <div>
              <p className="text-white font-bold">
                {pct(h2hHomeStats.btts, h2hHomeStats.matches)}%
              </p>
              <p className="text-slate-400 text-xs">BTTS</p>
            </div>
            <div>
              <p className="text-white font-bold">
                {pct(h2hHomeStats.over25, h2hHomeStats.matches)}%
              </p>
              <p className="text-slate-400 text-xs">+2.5 goles</p>
            </div>
            <div>
              <p className="text-white font-bold">
                {pct(h2hHomeStats.cleanSheets + h2hAwayStats.cleanSheets, h2hHomeStats.matches * 2)}%
              </p>
              <p className="text-slate-400 text-xs">Portería a 0</p>
            </div>
          </div>

          <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800/50 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="py-2 px-2 text-left">Fecha</th>
                  <th className="py-2 px-2 text-left">L/V</th>
                  <th className="py-2 px-2 text-left">Rival</th>
                  <th className="py-2 px-2 text-left">Liga</th>
                  <th className="py-2 px-2 text-center">Res.</th>
                  <th className="py-2 px-2 text-center">R</th>
                </tr>
              </thead>
              <tbody>
                {h2hFixtures.slice(0, 20).map((f) => (
                  <FixtureRow key={f.fixture.id} f={f} teamId={homeId} showLeague />
                ))}
              </tbody>
            </table>
            {h2hFixtures.length === 0 && (
              <p className="text-center py-8 text-slate-500">Sin historial de enfrentamientos</p>
            )}
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

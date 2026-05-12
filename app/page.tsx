'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LEAGUES, CURRENT_SEASON } from '@/lib/constants';
import type { Fixture, LeagueConfig, StandingRow, SavedMatch } from '@/types/football';
import { getSavedMatches, removeSavedMatch } from '@/lib/favorites';
import StandingsTable from '@/components/StandingsTable';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function formatDayLabel(dateStr: string): string {
  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  if (dateStr === today) return 'Hoy';
  if (dateStr === tomorrow) return 'Mañana';
  if (dateStr === yesterday) return 'Ayer';
  return new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

type DayEntry = { fixtures: Fixture[]; loading: boolean; error: string };

function formatMatchTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const live = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status);
  const finished = ['FT', 'AET', 'PEN'].includes(status);
  if (live) return <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-xs font-bold animate-pulse">EN VIVO</span>;
  if (finished) return <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-400 text-xs">FT</span>;
  return <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">{status}</span>;
}

type HomeView = 'partidos' | 'clasificacion';

const DAYS_TO_SHOW = 4;

export default function HomePage() {
  const router = useRouter();
  const [selectedLeague, setSelectedLeague] = useState<LeagueConfig>(LEAGUES[0]);
  const [baseDate, setBaseDate] = useState(todayStr());
  const [dayData, setDayData] = useState<Record<string, DayEntry>>({});
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<HomeView>('partidos');
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [standingsError, setStandingsError] = useState('');
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([]);

  const dates = Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(baseDate, i));

  useEffect(() => { setSavedMatches(getSavedMatches()); }, []);

  useEffect(() => {
    if (view === 'partidos') fetchAllDays();
    else fetchStandings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeague, baseDate, view]);

  async function fetchAllDays() {
    const init: Record<string, DayEntry> = {};
    dates.forEach(d => { init[d] = { fixtures: [], loading: true, error: '' }; });
    setDayData(init);

    await Promise.all(dates.map(async (d) => {
      try {
        const res = await fetch(`/api/fixtures?league=${selectedLeague.code}&date=${d}&season=${CURRENT_SEASON}`);
        const data = await res.json();
        setDayData(prev => ({
          ...prev,
          [d]: {
            fixtures: data.response ?? [],
            loading: false,
            error: data.response ? '' : (data.error ?? data.message ?? 'Sin partidos'),
          },
        }));
      } catch {
        setDayData(prev => ({ ...prev, [d]: { fixtures: [], loading: false, error: 'Error de conexión' } }));
      }
    }));
  }

  function navigate(delta: number) {
    setBaseDate(prev => addDays(prev, delta));
  }

  function toggleDay(d: string) {
    setCollapsedDays(prev => ({ ...prev, [d]: !prev[d] }));
  }

  async function fetchStandings() {
    setLoadingStandings(true);
    setStandingsError('');
    try {
      const res = await fetch(`/api/standings?league=${selectedLeague.code}`);
      const data = await res.json();
      if (data.table) setStandings(data.table);
      else { setStandings([]); setStandingsError(data.error ?? 'No disponible'); }
    } catch {
      setStandingsError('Error al cargar clasificación');
    } finally {
      setLoadingStandings(false);
    }
  }

  function goToMatch(f: Fixture) {
    const params = new URLSearchParams({
      home: String(f.teams.home.id),
      away: String(f.teams.away.id),
      league: String(f.league.id),
      season: String(f.league.season),
      homeName: f.teams.home.name,
      awayName: f.teams.away.name,
      homeLogo: f.teams.home.logo,
      awayLogo: f.teams.away.logo,
      leagueName: f.league.name,
      date: f.fixture.date,
    });
    router.push(`/match/${f.fixture.id}?${params}`);
  }

  return (
    <div className="space-y-6">
      {/* Saved Matches Bar */}
      {savedMatches.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">⭐ Guardados</h2>
          <div className="flex flex-wrap gap-2">
            {savedMatches.map((m) => (
              <div key={m.fixtureId} className="flex items-center gap-2 bg-[#111827] border border-slate-700 rounded-lg px-3 py-1.5 group">
                <button
                  onClick={() => {
                    const params = new URLSearchParams({
                      home: String(m.homeId), away: String(m.awayId),
                      league: String(m.leagueId), season: String(m.season),
                      homeName: m.homeName, awayName: m.awayName,
                      homeLogo: m.homeLogo, awayLogo: m.awayLogo,
                      leagueName: m.leagueName, date: m.date,
                    });
                    router.push(`/match/${m.fixtureId}?${params}`);
                  }}
                  className="text-xs text-slate-300 hover:text-white"
                >
                  {m.homeName} vs {m.awayName}
                </button>
                <button
                  onClick={() => { removeSavedMatch(m.fixtureId); setSavedMatches(getSavedMatches()); }}
                  className="text-slate-600 hover:text-red-400 text-xs ml-1"
                >✕</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* League Selector */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Selecciona la Liga
        </h2>
        <div className="flex flex-wrap gap-2">
          {LEAGUES.map((lg) => (
            <button
              key={lg.id}
              onClick={() => setSelectedLeague(lg)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                selectedLeague.id === lg.id
                  ? 'bg-green-500/20 border-green-500 text-green-400'
                  : 'bg-[#111827] border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span>{lg.flag}</span>
              <span>{lg.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* View Toggle + Date Navigation */}
      <section className="flex flex-wrap items-center gap-3">
        <div className="flex bg-[#111827] border border-slate-700 rounded-lg p-1 gap-1">
          {(['partidos', 'clasificacion'] as HomeView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                view === v ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v === 'partidos' ? '📅 Partidos' : '📊 Clasificación'}
            </button>
          ))}
        </div>
        {view === 'partidos' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#111827] border border-slate-700 text-slate-400 hover:border-green-500 hover:text-green-400 transition-all text-lg"
            >‹</button>
            <input
              type="date"
              value={baseDate}
              onChange={(e) => setBaseDate(e.target.value)}
              className="bg-[#111827] border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
            />
            <button
              onClick={() => navigate(1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#111827] border border-slate-700 text-slate-400 hover:border-green-500 hover:text-green-400 transition-all text-lg"
            >›</button>
            <button onClick={() => setBaseDate(todayStr())} className="text-xs text-green-400 hover:text-green-300 underline ml-1">Hoy</button>
          </div>
        )}
      </section>

      {/* Standings View */}
      {view === 'clasificacion' && (
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
            {selectedLeague.flag} {selectedLeague.name} — Clasificación
          </h2>
          {loadingStandings && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {standingsError && !loadingStandings && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{standingsError}</div>
          )}
          {!loadingStandings && standings.length > 0 && (
            <div className="bg-[#111827] rounded-xl border border-slate-800">
              <StandingsTable standings={standings} />
            </div>
          )}
        </section>
      )}

      {/* Multi-day Fixtures */}
      {view === 'partidos' && (
        <section className="space-y-4">
          {dates.map((d) => {
            const entry = dayData[d] ?? { fixtures: [], loading: true, error: '' };
            const isCollapsed = collapsedDays[d] ?? false;
            const isToday = d === todayStr();
            const label = formatDayLabel(d);

            return (
              <div key={d} className="bg-[#0d1520] rounded-xl border border-slate-800 overflow-hidden">
                {/* Day Header */}
                <button
                  onClick={() => toggleDay(d)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${ isToday ? 'text-green-400' : 'text-slate-300'}`}>
                      {label}
                    </span>
                    <span className="text-xs text-slate-500">{d}</span>
                    {isToday && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Hoy</span>}
                    {!entry.loading && (
                      <span className="text-xs text-slate-500">{entry.fixtures.length} partidos</span>
                    )}
                  </div>
                  <span className={`text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>▲</span>
                </button>

                {!isCollapsed && (
                  <div className="px-3 pb-3">
                    {entry.loading && (
                      <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {!entry.loading && entry.error && entry.fixtures.length === 0 && (
                      <p className="text-center text-slate-500 text-sm py-6">Sin partidos para {selectedLeague.name} este día</p>
                    )}
                    <div className="grid gap-2">
                      {entry.fixtures.map((f) => {
                        const status = f.fixture.status.short;
                        const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status);
                        const isDone = ['FT', 'AET', 'PEN'].includes(status);
                        return (
                          <div
                            key={f.fixture.id}
                            onClick={() => goToMatch(f)}
                            className={`bg-[#111827] border rounded-xl p-3 cursor-pointer transition-all hover:border-green-500/50 hover:bg-[#131f35] group ${
                              isLive ? 'border-green-500/40' : 'border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-1 justify-end">
                                <span className="text-sm font-semibold text-right text-slate-200 group-hover:text-white">{f.teams.home.name}</span>
                                {f.teams.home.logo && <img src={f.teams.home.logo} alt="" className="w-7 h-7 object-contain" />}
                              </div>
                              <div className="flex flex-col items-center min-w-[72px]">
                                {isDone || isLive ? (
                                  <div className="flex items-center gap-1.5 text-lg font-bold">
                                    <span className={f.teams.home.winner ? 'text-white' : 'text-slate-400'}>{f.goals.home ?? 0}</span>
                                    <span className="text-slate-600">-</span>
                                    <span className={f.teams.away.winner ? 'text-white' : 'text-slate-400'}>{f.goals.away ?? 0}</span>
                                  </div>
                                ) : (
                                  <span className="text-base font-bold text-slate-300">{formatMatchTime(f.fixture.date)}</span>
                                )}
                                <StatusBadge status={status} />
                                {f.fixture.status.elapsed && isLive && <span className="text-xs text-green-400">{f.fixture.status.elapsed}&apos;</span>}
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                {f.teams.away.logo && <img src={f.teams.away.logo} alt="" className="w-7 h-7 object-contain" />}
                                <span className="text-sm font-semibold text-slate-200 group-hover:text-white">{f.teams.away.name}</span>
                              </div>
                              <span className="text-slate-600 group-hover:text-green-400 text-base">→</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

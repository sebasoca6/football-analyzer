'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LEAGUES, CURRENT_SEASON } from '@/lib/constants';
import type { Fixture, LeagueConfig } from '@/types/football';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

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

export default function HomePage() {
  const router = useRouter();
  const [selectedLeague, setSelectedLeague] = useState<LeagueConfig>(LEAGUES[0]);
  const [date, setDate] = useState(todayStr());
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFixtures();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeague, date]);

  async function fetchFixtures() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/fixtures?league=${selectedLeague.code}&date=${date}&season=${CURRENT_SEASON}`
      );
      const data = await res.json();
      if (data.response) {
        setFixtures(data.response);
      } else {
        setFixtures([]);
        setError(data.error ?? data.message ?? 'No se encontraron partidos para esta fecha');
      }
    } catch {
      setError('Error de conexión. Verifica tu API key.');
    } finally {
      setLoading(false);
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

      {/* Date Selector */}
      <section className="flex items-center gap-4">
        <label className="text-sm text-slate-400">Fecha:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-[#111827] border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
        />
        <button
          onClick={() => setDate(todayStr())}
          className="text-xs text-green-400 hover:text-green-300 underline"
        >
          Hoy
        </button>
      </section>

      {/* Fixtures */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
          {selectedLeague.flag} {selectedLeague.name} — {date}
        </h2>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && fixtures.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-2">📅</div>
            <p>No hay partidos para esta fecha en {selectedLeague.name}</p>
            <p className="text-xs mt-1 text-slate-600">Prueba con otra fecha o liga</p>
          </div>
        )}

        <div className="grid gap-3">
          {fixtures.map((f) => {
            const status = f.fixture.status.short;
            const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'].includes(status);
            const isDone = ['FT', 'AET', 'PEN'].includes(status);

            return (
              <div
                key={f.fixture.id}
                onClick={() => goToMatch(f)}
                className={`bg-[#111827] border rounded-xl p-4 cursor-pointer transition-all hover:border-green-500/50 hover:bg-[#131f35] group ${
                  isLive ? 'border-green-500/40' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Home Team */}
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <span className="text-sm font-semibold text-right text-slate-200 group-hover:text-white">
                      {f.teams.home.name}
                    </span>
                    {f.teams.home.logo && (
                      <img src={f.teams.home.logo} alt="" className="w-8 h-8 object-contain" />
                    )}
                  </div>

                  {/* Score / Time */}
                  <div className="flex flex-col items-center min-w-[80px]">
                    {isDone || isLive ? (
                      <div className="flex items-center gap-2 text-xl font-bold">
                        <span className={f.teams.home.winner ? 'text-white' : 'text-slate-400'}>
                          {f.goals.home ?? 0}
                        </span>
                        <span className="text-slate-600">-</span>
                        <span className={f.teams.away.winner ? 'text-white' : 'text-slate-400'}>
                          {f.goals.away ?? 0}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-bold text-slate-300">
                        {formatMatchTime(f.fixture.date)}
                      </span>
                    )}
                    <StatusBadge status={status} />
                    {f.fixture.status.elapsed && isLive && (
                      <span className="text-xs text-green-400">{f.fixture.status.elapsed}&apos;</span>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center gap-3 flex-1">
                    {f.teams.away.logo && (
                      <img src={f.teams.away.logo} alt="" className="w-8 h-8 object-contain" />
                    )}
                    <span className="text-sm font-semibold text-slate-200 group-hover:text-white">
                      {f.teams.away.name}
                    </span>
                  </div>

                  {/* Arrow */}
                  <span className="text-slate-600 group-hover:text-green-400 transition-colors text-lg">→</span>
                </div>

                {f.fixture.venue.name && (
                  <p className="text-center text-xs text-slate-600 mt-1">
                    📍 {f.fixture.venue.name}, {f.fixture.venue.city}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

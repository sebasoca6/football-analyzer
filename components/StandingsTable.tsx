'use client';

import type { StandingRow } from '@/types/football';

function parseForm(form: string | null): string[] {
  if (!form) return [];
  const chars = form.includes(',') ? form.split(',') : form.split('');
  return chars.filter((c) => c === 'W' || c === 'D' || c === 'L').slice(0, 5);
}

function FormBadge({ c }: { c: string }) {
  const bg =
    c === 'W' ? 'bg-green-500' :
    c === 'D' ? 'bg-slate-500' :
    'bg-red-500';
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-white text-xs font-bold flex-shrink-0 ${bg}`}
    >
      {c}
    </span>
  );
}

function PosBadge({ pos, total }: { pos: number; total: number }) {
  const cls =
    pos <= 4 ? 'bg-blue-600 text-white' :
    pos === 5 ? 'bg-green-500 text-white' :
    pos === 6 ? 'bg-orange-500 text-white' :
    pos >= total - 2 ? 'bg-red-600 text-white' :
    'bg-slate-700/80 text-slate-300';
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${cls}`}
    >
      {pos}
    </span>
  );
}

interface Props {
  standings: StandingRow[];
  homeTeamId?: number;
  awayTeamId?: number;
}

export default function StandingsTable({ standings, homeTeamId, awayTeamId }: Props) {
  const total = standings.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
            <th className="py-2 px-2 text-center w-8">#</th>
            <th className="py-2 px-3 text-left">Equipo</th>
            <th className="py-2 px-2 text-center w-8">P</th>
            <th className="py-2 px-2 text-center w-8">W</th>
            <th className="py-2 px-2 text-center w-8">D</th>
            <th className="py-2 px-2 text-center w-8">L</th>
            <th className="py-2 px-2 text-center w-12">DIFF</th>
            <th className="py-2 px-2 text-center w-16">GLS</th>
            <th className="py-2 px-3 text-center w-32">Últimos 5</th>
            <th className="py-2 px-3 text-center w-10 font-bold text-white">PTS</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const isHome = homeTeamId !== undefined && row.team.id === homeTeamId;
            const isAway = awayTeamId !== undefined && row.team.id === awayTeamId;
            const form = parseForm(row.form);
            const pos = row.position;

            const rowBg =
              isHome ? 'bg-blue-500/10 border-l-2 border-l-blue-500' :
              isAway ? 'bg-orange-500/10 border-l-2 border-l-orange-500' :
              pos <= 4 ? 'hover:bg-blue-500/5' :
              pos >= total - 2 ? 'hover:bg-red-500/5' :
              'hover:bg-slate-800/30';

            return (
              <tr
                key={row.team.id}
                className={`border-b border-slate-800/60 transition-colors ${rowBg}`}
              >
                {/* Position */}
                <td className="py-2 px-2 text-center">
                  <PosBadge pos={pos} total={total} />
                </td>

                {/* Team */}
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    {row.team.crest && (
                      <img src={row.team.crest} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                    )}
                    <span className={`font-medium truncate max-w-[140px] ${isHome ? 'text-blue-300' : isAway ? 'text-orange-300' : 'text-slate-200'}`}>
                      {row.team.shortName || row.team.name}
                      {isHome && <span className="ml-1 text-xs text-blue-400 font-normal">(L)</span>}
                      {isAway && <span className="ml-1 text-xs text-orange-400 font-normal">(V)</span>}
                    </span>
                  </div>
                </td>

                {/* Played */}
                <td className="py-2 px-2 text-center text-slate-400 font-mono">{row.playedGames}</td>

                {/* Wins */}
                <td className="py-2 px-2 text-center font-semibold text-green-400">{row.won}</td>

                {/* Draws */}
                <td className="py-2 px-2 text-center font-semibold text-yellow-400">{row.draw}</td>

                {/* Losses */}
                <td className="py-2 px-2 text-center font-semibold text-red-400">{row.lost}</td>

                {/* Goal difference */}
                <td className={`py-2 px-2 text-center font-semibold font-mono ${
                  row.goalDifference > 0 ? 'text-green-400' :
                  row.goalDifference < 0 ? 'text-red-400' :
                  'text-slate-400'
                }`}>
                  {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
                </td>

                {/* GF:GA */}
                <td className="py-2 px-2 text-center text-slate-400 font-mono text-xs">
                  {row.goalsFor}:{row.goalsAgainst}
                </td>

                {/* Last 5 form badges */}
                <td className="py-2 px-3">
                  <div className="flex gap-0.5 justify-center">
                    {form.length > 0
                      ? form.map((c, i) => <FormBadge key={i} c={c} />)
                      : <span className="text-xs text-slate-600">—</span>
                    }
                  </div>
                </td>

                {/* Points */}
                <td className="py-2 px-3 text-center">
                  <span className="font-black text-white text-base">{row.points}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-3 py-2.5 border-t border-slate-800 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />Champions League
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />UCL Classif.
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />Europa League
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />Descenso
        </span>
      </div>
    </div>
  );
}

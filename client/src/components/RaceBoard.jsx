import { useEffect, useState } from 'react';
import { Medal, Trophy } from 'lucide-react';
import { plain, signed, troopColor } from '../lib/format.js';
import LiveStatus from './LiveStatus.jsx';

const MEDAL_COLORS = { 1: 'text-gold', 2: 'text-slate-300', 3: 'text-amber-600' };

function RankMark({ rank, showMedal }) {
  if (!showMedal) return <span className="font-display text-3xl font-bold text-white/30" aria-label="No rank yet">{'\u2013'}</span>;
  const label = `Rank ${rank}`;
  if (showMedal && rank === 1) return <Trophy className="size-8 text-gold" aria-label={label} />;
  if (showMedal && rank <= 3) return <Medal className={`size-8 ${MEDAL_COLORS[rank]}`} aria-label={label} />;
  return <span className="font-display text-3xl font-bold text-white/50" aria-label={label}>{rank}</span>;
}

function Stat({ value, label, tone }) {
  return (
    <span className="whitespace-nowrap">
      <span className={`font-semibold ${value === 0 ? 'text-white/50' : tone}`}>{signed(value)}</span> {label}
    </span>
  );
}

function Lane({ troop, max, ready, hasPoints }) {
  const color = troopColor(troop.name, troop.id);
  const pct = max > 0 && troop.total > 0 ? Math.max((troop.total / max) * 100, 3) : 0;
  const leading = hasPoints && troop.rank === 1;

  return (
    <li className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[3rem_16rem_1fr_5.5rem] md:gap-x-5">
      <div className="flex justify-center"><RankMark rank={troop.rank} showMedal={hasPoints} /></div>

      <div className="min-w-0">
        <h3 className="truncate font-display text-3xl font-bold leading-none">{troop.name}</h3>
        <p className="mt-1.5 flex flex-wrap gap-x-3 text-sm text-white/70">
          <Stat value={troop.merit} label="merit" tone="text-emerald-300" />
          <Stat value={-troop.demerit} label="demerit" tone="text-red-300" />
          <Stat value={troop.gameTotal} label="games" tone="text-white" />
        </p>
      </div>

      <p className={`order-3 text-right font-display text-5xl font-extrabold leading-none tabular-nums md:order-4 ${leading ? 'text-gold' : ''} ${troop.total < 0 ? 'text-red-300' : ''}`}>
        {plain(troop.total)}
        <span className="sr-only"> points</span>
      </p>

      <div className="order-4 col-span-3 h-5 overflow-hidden rounded-full bg-white/10 md:order-3 md:col-span-1 md:h-6" aria-hidden="true">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: ready ? `${pct}%` : '0%', backgroundColor: color }}
        />
      </div>
    </li>
  );
}

function LaneSkeleton() {
  return (
    <li className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-3 gap-y-2 md:grid-cols-[3rem_16rem_1fr_5.5rem] md:gap-x-5 motion-safe:animate-pulse">
      <div className="mx-auto size-8 rounded-full bg-white/10" />
      <div className="space-y-2"><div className="h-7 w-28 rounded bg-white/10" /><div className="h-3 w-40 max-w-full rounded bg-white/10" /></div>
      <div className="order-3 h-10 w-16 rounded bg-white/10 md:order-4" />
      <div className="order-4 col-span-3 h-5 rounded-full bg-white/10 md:order-3 md:col-span-1 md:h-6" />
    </li>
  );
}

export default function RaceBoard({ troops, loading, slow, updatedAt, failing }) {
  // Bars grow in once on first load, then glide whenever the numbers change.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!troops) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [troops]);

  const max = troops ? Math.max(...troops.map((t) => t.total), 0) : 0;
  const hasPoints = max > 0;

  return (
    <section aria-labelledby="board-title" className="rounded-3xl bg-pine-950 p-5 text-white shadow-lg sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 id="board-title" className="font-display text-6xl font-extrabold leading-[0.9] sm:text-7xl">Brigade 2026</h1>
          <p className="mt-2 font-display text-2xl font-semibold text-white/70">Troop standings</p>
        </div>
        <LiveStatus updatedAt={updatedAt} failing={failing} />
      </div>

      <ol className="mt-8 space-y-6 sm:space-y-7">
        {loading || !troops
          ? Array.from({ length: 5 }, (_, i) => <LaneSkeleton key={i} />)
          : troops.map((t) => <Lane key={t.id} troop={t} max={max} ready={ready} hasPoints={hasPoints} />)}
      </ol>

      {loading && slow && (
        <p className="mt-6 text-sm text-gold" role="status">
          Waking up the server. The first load can take up to a minute.
        </p>
      )}
      {!loading && troops && !hasPoints && (
        <p className="mt-6 text-sm text-white/70">No points yet. Standings appear here as soon as the first score is added.</p>
      )}
    </section>
  );
}

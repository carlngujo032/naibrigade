import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Award, Crown, Maximize, Medal, Minimize, ShieldAlert, Trophy, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { plain, signed, troopColor } from '../lib/format.js';
import { usePolling } from '../lib/usePolling.js';
import LiveStatus from '../components/LiveStatus.jsx';

// Every size below is relative to the card width (cqw) and capped by screen height (--u = 1vh,
// or about half of that when teams wrap onto two rows),
// so the cards fill any TV without scrolling, whether there are 4 teams or 8.
const size = (cqw, vh) => ({ fontSize: `min(${cqw}cqw, calc(${vh} * var(--u)))` });
const iconSize = { width: 'min(11cqw, calc(5 * var(--u)))', height: 'min(11cqw, calc(5 * var(--u)))' };

function RankMark({ rank, hasPoints }) {
  if (!hasPoints) return <span className="font-display font-bold text-white/30" style={size(11, 5)} aria-label="No rank yet">{'\u2013'}</span>;
  if (rank === 1) return <Trophy className="text-gold" style={iconSize} aria-label="Rank 1" />;
  if (rank === 2) return <Medal className="text-slate-300" style={iconSize} aria-label="Rank 2" />;
  if (rank === 3) return <Medal className="text-amber-600" style={iconSize} aria-label="Rank 3" />;
  return <span className="font-display font-bold text-white/50" style={size(11, 5)} aria-label={`Rank ${rank}`}>{rank}</span>;
}

function TeamCard({ troop, categories, best, max }) {
  const color = troopColor(troop.name, troop.id);
  const hasPoints = max > 0;
  const leading = hasPoints && troop.rank === 1;
  const pct = max > 0 && troop.total > 0 ? Math.max((troop.total / max) * 100, 3) : 0;
  // More games means smaller rows, so a long list still fits the card.
  const rowVh = Math.min(2.8, 17 / Math.max(categories.length, 1));

  return (
    <article
      className={`@container flex min-h-0 flex-col overflow-hidden rounded-[2.2cqw] bg-pine-900 ${leading ? 'ring-[calc(0.5*var(--u))] ring-gold' : 'ring-1 ring-white/10'}`}
    >
      <div className="shrink-0" style={{ height: 'calc(1 * var(--u))', backgroundColor: color }} aria-hidden="true" />
      <div className="flex min-h-0 flex-1 flex-col gap-[calc(1.6*var(--u))] p-[6cqw]">
        <header className="flex items-center justify-between gap-[3cqw]" style={{ height: 'min(14cqw, calc(6.5 * var(--u)))' }}>
          <h2 className="truncate font-display font-bold leading-none" style={size(14, 6.5)}>{troop.name}</h2>
          <RankMark rank={troop.rank} hasPoints={hasPoints} />
        </header>

        <div>
          <p className={`font-display font-extrabold leading-none tabular-nums ${leading ? 'text-gold' : troop.total < 0 ? 'text-red-300' : ''}`} style={size(34, 15)}>
            {plain(troop.total)}
          </p>
          <p className="text-white/60" style={size(5.5, 2.2)}>total points</p>
          <div className="mt-[calc(1.2*var(--u))] h-[calc(1.2*var(--u))] overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
        </div>

        <ul className="flex min-h-0 flex-1 flex-col justify-evenly border-t border-white/10 pt-[calc(1*var(--u))]" aria-label={`${troop.name} scores by game`}>
          {categories.map((c) => {
            const score = troop.games.find((g) => g.categoryId === c.id)?.score ?? 0;
            const wins = score > 0 && score === best[c.id];
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-[2cqw] rounded-[1.5cqw] px-[2.5cqw] py-[calc(0.3*var(--u))]"
                style={{ ...size(6.5, rowVh), backgroundColor: wins ? `${color}40` : undefined }}
              >
                <span className={`truncate ${wins ? 'font-semibold' : 'text-white/80'}`}>{c.name}</span>
                <span className={`flex shrink-0 items-center gap-[1.2cqw] font-display tabular-nums ${wins ? 'font-extrabold' : 'font-bold text-white/90'}`} style={{ fontSize: '1.25em' }}>
                  {wins && <Crown className="size-[0.9em]" aria-label="Best score" />}
                  {plain(score)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="grid grid-cols-2 gap-[3cqw]">
          <div className="rounded-[2cqw] bg-white/5 px-[4cqw] py-[calc(1*var(--u))]">
            <p className="text-white/60" style={size(5.2, 2.1)}>Merit</p>
            <p className={`font-display font-extrabold leading-none tabular-nums ${troop.merit === 0 ? 'text-white/40' : 'text-emerald-300'}`} style={size(12, 5)}>{signed(troop.merit)}</p>
          </div>
          <div className="rounded-[2cqw] bg-white/5 px-[4cqw] py-[calc(1*var(--u))]">
            <p className="text-white/60" style={size(5.2, 2.1)}>Demerit</p>
            <p className={`font-display font-extrabold leading-none tabular-nums ${troop.demerit === 0 ? 'text-white/40' : 'text-red-300'}`} style={size(12, 5)}>{troop.demerit ? signed(-troop.demerit) : '0'}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

// Rotates through the latest awards along the bottom of the screen.
function Ticker({ activity }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 6000);
    return () => clearInterval(id);
  }, []);
  if (!activity.length) return <p className="text-white/50">Awards will appear here as they happen.</p>;
  const e = activity[i % Math.min(activity.length, 5)];
  const what = e.kind === 'merit' ? `${signed(e.points)} merit` : e.kind === 'demerit' ? `${signed(-e.points)} demerit` : `${signed(e.points)} in ${e.game ?? 'a game'}`;
  return (
    <p key={e.id} className="truncate">
      <span className="mr-3 inline-block size-[1.1vh] rounded-full align-middle" style={{ backgroundColor: troopColor(e.troopName, e.troopId) }} aria-hidden="true" />
      <span className="font-semibold">{e.troopName}</span> {what}
      {e.note && <span className="text-white/60">: {e.note}</span>}
    </p>
  );
}

// The merit and demerit guide pops up by itself on the TV: shown for GUIDE_SHOW_MS, hidden for GUIDE_HIDE_MS, repeat.
const GUIDE_SHOW_MS = 8_000;
const GUIDE_HIDE_MS = 30_000;

function GuideColumn({ title, Icon, items, sign, titleClass, rowClass }) {
  return (
    <section className="min-w-0">
      <h3 className={`flex items-center gap-[1vh] font-display font-bold ${titleClass}`} style={{ fontSize: '5vh' }}>
        <Icon style={{ width: '4.5vh', height: '4.5vh' }} aria-hidden="true" /> {title}
      </h3>
      <ul className="mt-[1.5vh] space-y-[1vh]">
        {items.map((r) => (
          <li key={r.label} className={`flex items-center justify-between gap-[1.5vh] rounded-[1.2vh] px-[2vh] py-[1.2vh] font-medium ${rowClass}`} style={{ fontSize: '3vh' }}>
            <span className="min-w-0">{r.label}</span>
            <span className="shrink-0 font-display font-bold tabular-nums" style={{ fontSize: '4vh' }}>{sign}{r.points}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GuidePopup({ rules, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-[4vh]" role="dialog" aria-label="Merit and demerit guide" onClick={onClose}>
      <div className="relative w-full max-w-[90vw] rounded-[3vh] bg-white p-[4vh] text-pine-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close guide"
          className="absolute right-[2vh] top-[2vh] grid place-items-center rounded-full bg-pine-900/10 text-pine-900 hover:bg-pine-900/20"
          style={{ width: '6vh', height: '6vh' }}
        >
          <X style={{ width: '3.6vh', height: '3.6vh' }} aria-hidden="true" />
        </button>
        <h2 className="pr-[8vh] font-display font-extrabold text-pine-900" style={{ fontSize: '6vh' }}>Merit and demerit guide</h2>
        <div className="mt-[2vh] grid grid-cols-2 gap-[4vh]">
          <GuideColumn title="Merits" Icon={Award} items={rules.merits} sign="+" titleClass="text-merit" rowClass="bg-merit/10" />
          <GuideColumn title="Demerits" Icon={ShieldAlert} items={rules.demerits} sign={'\u2212'} titleClass="text-demerit" rowClass="bg-demerit/10" />
        </div>
      </div>
    </div>
  );
}

export default function Tv() {
  const board = usePolling(async () => {
    const [leaderboard, feed] = await Promise.all([api.leaderboard(), api.activity(5)]);
    return { ...leaderboard, activity: feed.activity };
  }, 8_000);
  const [full, setFull] = useState(false);
  const [rules, setRules] = useState(null);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => api.rules().then((r) => { if (alive) setRules(r); }).catch(() => {});
    load();
    const refresh = setInterval(load, 60_000); // picks up guide edits made by organizers
    return () => { alive = false; clearInterval(refresh); };
  }, []);

  // Alternate between hidden (30 s) and shown (8 s) once the rules have loaded.
  const hasRules = !!rules;
  const closeGuide = useCallback(() => setGuide(false), []);
  useEffect(() => {
    if (!hasRules) return undefined;
    const timer = setTimeout(() => setGuide((g) => !g), guide ? GUIDE_SHOW_MS : GUIDE_HIDE_MS);
    return () => clearTimeout(timer);
  }, [hasRules, guide]);

  useEffect(() => { document.title = 'Brigade 2026 | TV view'; }, []);
  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const data = board.data;
  const troops = data?.troops ?? [];
  const max = Math.max(...troops.map((t) => t.total), 0);
  const best = Object.fromEntries((data?.categories ?? []).map((c) => [
    c.id,
    Math.max(...troops.map((t) => t.games.find((g) => g.categoryId === c.id)?.score ?? 0)),
  ]));
  // Up to 6 teams sit side by side; more than that wraps onto two rows.
  const cols = troops.length <= 6 ? Math.max(troops.length, 1) : Math.ceil(troops.length / 2);
  const rows = troops.length <= 6 ? 1 : 2;

  const controls = 'rounded-full p-[0.8vh] text-white/50 hover:bg-white/10 hover:text-white';

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-pine-950 text-white">
      <header className="flex items-center justify-between gap-6 px-[2vw] py-[1.2vh]">
        <div className="flex min-w-0 items-center gap-[1.2vw]">
          <img src="/logo.jpg" alt="" className="shrink-0 rounded-full bg-white" style={{ width: '6vh', height: '6vh' }} />
          <div className="min-w-0 leading-none">
            <h1 className="truncate font-display font-extrabold" style={{ fontSize: '4.6vh' }}>Brigade 2026</h1>
            <p className="truncate text-white/60" style={{ fontSize: '2vh' }}>Nissi Academy Inc.</p>
          </div>
        </div>
        <div className="flex items-center gap-[1vw]">
          <LiveStatus updatedAt={board.updatedAt} failing={!!board.error} className="" />
          <Link to="/" aria-label="Back to leaderboard" className={controls}><ArrowLeft style={{ width: '3vh', height: '3vh' }} aria-hidden="true" /></Link>
          <button type="button" onClick={toggleFull} aria-label={full ? 'Exit full screen' : 'Full screen'} className={controls}>
            {full ? <Minimize style={{ width: '3vh', height: '3vh' }} aria-hidden="true" /> : <Maximize style={{ width: '3vh', height: '3vh' }} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 px-[2vw]">
        {!data ? (
          <p className="grid h-full place-items-center text-white/70" style={{ fontSize: '3vh' }} role="status">
            {board.error ? board.error.message : 'Loading standings. The first load can take up to a minute.'}
          </p>
        ) : troops.length === 0 ? (
          <p className="grid h-full place-items-center text-white/70" style={{ fontSize: '3vh' }}>No teams yet.</p>
        ) : (
          <div
            className="grid h-full gap-[1.2vw]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, '--u': rows === 1 ? '1vh' : '0.46vh' }}
          >
            {troops.map((t) => <TeamCard key={t.id} troop={t} categories={data.categories} best={best} max={max} />)}
          </div>
        )}
      </main>

      {guide && rules && <GuidePopup rules={rules} onClose={closeGuide} />}

      <footer className="px-[2vw] py-[1.4vh] text-white/90" style={{ fontSize: '2.4vh' }}>
        <Ticker activity={data?.activity ?? []} />
      </footer>
    </div>
  );
}

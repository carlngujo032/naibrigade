import { Flag, Minus, Plus } from 'lucide-react';
import { signed, timeAgo, troopColor } from '../lib/format.js';

const KIND = {
  merit: { Icon: Plus, chip: 'bg-merit/15 text-merit', text: (e) => `${signed(e.points)} merit` },
  demerit: { Icon: Minus, chip: 'bg-demerit/15 text-demerit', text: (e) => `${signed(-e.points)} demerit` },
  game: { Icon: Flag, chip: 'bg-pine-900/10 text-pine-900', text: (e) => `${signed(e.points)} in ${e.game ?? 'a game'}` },
};

export function ActivityRow({ entry, color, action }) {
  const { Icon, chip, text } = KIND[entry.kind];
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${chip}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">
          <span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ backgroundColor: color }} aria-hidden="true" />
          {entry.troopName} <span className="font-normal text-ink/80">{text(entry)}</span>
        </p>
        {entry.note && <p className="text-sm text-muted">{entry.note}</p>}
        <p className="text-xs text-muted">{timeAgo(entry.createdAt)}</p>
      </div>
      {action}
    </li>
  );
}

export default function ActivityFeed({ activity }) {
  return (
    <section aria-labelledby="feed-title" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-pine-900/10 sm:p-6">
      <h2 id="feed-title" className="font-display text-3xl font-bold text-pine-900">Recent points</h2>
      {activity.length === 0 ? (
        <p className="mt-3 text-muted">Nothing yet. New awards show up here as they happen.</p>
      ) : (
        <ul className="mt-2 divide-y divide-pine-900/10">
          {activity.map((e) => <ActivityRow key={e.id} entry={e} color={troopColor(e.troopName, e.troopId)} />)}
        </ul>
      )}
    </section>
  );
}

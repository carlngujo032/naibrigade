import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { ActivityRow } from '../ActivityFeed.jsx';
import { troopColor } from '../../lib/format.js';

function UndoButton({ onConfirm }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Two taps to undo, so a stray tap can't remove points.
  useEffect(() => {
    if (!armed) return undefined;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);

  async function click() {
    if (!armed) return setArmed(true);
    setBusy(true);
    await onConfirm();
    setBusy(false);
    setArmed(false);
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${armed ? 'bg-demerit text-white' : 'bg-pine-900/10 text-pine-900 hover:bg-pine-900/20'}`}
    >
      <Undo2 className="size-4" aria-hidden="true" />
      {armed ? 'Confirm undo' : 'Undo'}
    </button>
  );
}

export default function HistoryList({ activity, onUndo }) {
  return (
    <section aria-labelledby="history-title" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-pine-900/10 sm:p-6">
      <h2 id="history-title" className="font-display text-3xl font-bold text-pine-900">Latest entries</h2>
      <p className="mt-1 text-sm text-muted">Made a mistake? Undo removes the entry and puts the points back.</p>
      {activity.length === 0 ? (
        <p className="mt-4 text-muted">No entries yet. Add the first points using the form.</p>
      ) : (
        <ul className="mt-2 max-h-[28rem] divide-y divide-pine-900/10 overflow-y-auto pr-1">
          {activity.map((e) => (
            <ActivityRow key={e.id} entry={e} color={troopColor(e.troopName, e.troopId)} action={<UndoButton onConfirm={() => onUndo(e.id)} />} />
          ))}
        </ul>
      )}
    </section>
  );
}

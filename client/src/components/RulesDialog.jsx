import { useEffect, useRef } from 'react';
import { Award, ShieldAlert, X } from 'lucide-react';

function RuleList({ title, Icon, items, tone, sign }) {
  return (
    <section>
      <h3 className={`flex items-center gap-2 font-display text-2xl font-bold ${tone.title}`}>
        <Icon className="size-5" aria-hidden="true" /> {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((r) => (
          <li key={r.label} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 font-medium ${tone.row}`}>
            <span>{r.label}</span>
            <span className="font-display text-2xl font-bold tabular-nums">{sign}{r.points}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RulesDialog({ open, onClose, rules }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby="rules-title"
      className="m-auto w-[min(56rem,calc(100%-2rem))] rounded-3xl bg-white p-0 text-ink shadow-2xl"
    >
      <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="rules-title" className="font-display text-4xl font-extrabold text-pine-900">Merit and demerit guide</h2>
            <p className="mt-1 text-muted">Points added to or taken off a troop's total during camp.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close guide" className="rounded-full p-2 text-muted hover:bg-pine-900/10">
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>

        {rules ? (
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <RuleList title="Merits" Icon={Award} items={rules.merits} sign="+" tone={{ title: 'text-merit', row: 'bg-merit/10 text-pine-950' }} />
            <RuleList title="Demerits" Icon={ShieldAlert} items={rules.demerits} sign={'\u2212'} tone={{ title: 'text-demerit', row: 'bg-demerit/10 text-pine-950' }} />
          </div>
        ) : (
          <p className="mt-6 text-muted">Loading the guide.</p>
        )}
      </div>
    </dialog>
  );
}

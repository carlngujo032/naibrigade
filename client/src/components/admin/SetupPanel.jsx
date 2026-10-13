import { useCallback, useEffect, useState } from 'react';
import { Award, Flag, ListChecks, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api.js';
import ConfirmButton from '../ConfirmButton.jsx';
import Toast from '../Toast.jsx';

const card = 'rounded-3xl bg-white p-5 shadow-sm ring-1 ring-pine-900/10 sm:p-6';
const inputBase = 'rounded-xl border-2 border-pine-900/20 px-4 py-2.5 text-lg focus:border-pine-900 focus:outline-none';
const primaryBtn = 'rounded-full bg-pine-900 px-5 py-2.5 font-semibold text-white hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-40';
const quietBtn = 'rounded-full bg-pine-900/10 px-4 py-2 text-sm font-semibold text-pine-900 hover:bg-pine-900/20 disabled:opacity-40';

const validPoints = (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 1000 && String(v).trim() !== '';

/** One line in a list: shows the name (and points), with edit and delete. */
function Row({ label, points, sign, tone = 'bg-pine-900/5', badge, readOnly = false, scores = null, onSave, onDelete }) {
  const withPoints = points !== undefined;
  const [editing, setEditing] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [name, setName] = useState(label);
  const [pts, setPts] = useState(String(points ?? ''));
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && (!withPoints || validPoints(pts));

  async function save(e) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onSave(name.trim(), Number(pts));
    setBusy(false);
    if (ok) setEditing(false);
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={save} className="flex flex-wrap items-center gap-2 rounded-xl bg-pine-900/5 p-3">
          <input aria-label={`Name of ${label}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={withPoints ? 80 : 100} className={`${inputBase} min-w-0 flex-1`} autoFocus />
          {withPoints && (
            <input aria-label={`Points for ${label}`} type="number" inputMode="numeric" min="1" max="1000" value={pts} onChange={(e) => setPts(e.target.value)} className={`${inputBase} w-24 shrink-0 text-right`} />
          )}
          <button type="submit" disabled={!valid || busy} className={primaryBtn}>{busy ? 'Saving' : 'Save'}</button>
          <button type="button" onClick={() => setEditing(false)} className={quietBtn}>Cancel</button>
        </form>
      </li>
    );
  }

  return (
    <li className={`rounded-xl ${tone}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1 font-medium">{label}</span>
        {badge}
        {withPoints && <span className="font-display text-2xl font-bold tabular-nums">{sign}{points}</span>}
        {scores && (
          <button type="button" onClick={() => setShowScores((v) => !v)} aria-expanded={showScores} className={`${quietBtn} flex items-center gap-1.5`}>
            <ListChecks className="size-4" aria-hidden="true" />Scores
          </button>
        )}
        {!readOnly && (
          <span className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => { setName(label); setPts(String(points ?? '')); setEditing(true); }} aria-label={`Edit ${label}`} className="rounded-full p-2 text-muted hover:bg-pine-900/10">
              <Pencil className="size-5" aria-hidden="true" />
            </button>
            <ConfirmButton Icon={Trash2} label="Delete" confirmLabel="Confirm delete" onConfirm={onDelete} />
          </span>
        )}
      </div>
      {scores && showScores && <div className="border-t border-pine-900/10 px-4 py-3">{scores}</div>}
    </li>
  );
}

/** One troop's score in a game, editable. */
function TroopScore({ troop, game, current, onSave }) {
  const [val, setVal] = useState(String(current));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setVal(String(current)); }, [current]);
  const n = Number(val);
  const valid = val.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 5000;
  const changed = valid && n !== current;

  async function save(e) {
    e.preventDefault();
    if (!changed || busy) return;
    setBusy(true);
    await onSave(n);
    setBusy(false);
  }

  return (
    <li>
      <form onSubmit={save} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
        <span className="min-w-0 flex-1 font-medium">{troop.name}</span>
        <input aria-label={`${troop.name} score in ${game}`} type="number" inputMode="numeric" min="0" max="5000" value={val} onChange={(e) => setVal(e.target.value)} className={`${inputBase} w-24 shrink-0 py-1.5 text-right`} />
        <button type="submit" disabled={!changed || busy} className={quietBtn}>{busy ? 'Saving' : 'Save'}</button>
      </form>
    </li>
  );
}

function AddForm({ placeholder, withPoints = false, onAdd }) {
  const [name, setName] = useState('');
  const [pts, setPts] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && (!withPoints || validPoints(pts));

  async function submit(e) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onAdd(name.trim(), Number(pts));
    setBusy(false);
    if (ok) { setName(''); setPts(''); }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2 border-t border-pine-900/10 pt-4">
      <input aria-label={placeholder} value={name} onChange={(e) => setName(e.target.value)} maxLength={withPoints ? 80 : 100} placeholder={placeholder} className={`${inputBase} min-w-0 flex-1`} />
      {withPoints && (
        <input aria-label="Points" type="number" inputMode="numeric" min="1" max="1000" value={pts} onChange={(e) => setPts(e.target.value)} placeholder="Points" className={`${inputBase} w-24 shrink-0 text-right`} />
      )}
      <button type="submit" disabled={!valid || busy} className={`${primaryBtn} flex items-center gap-2`}>
        <Plus className="size-4" aria-hidden="true" />Add
      </button>
    </form>
  );
}

export default function SetupPanel({ onUnauthorized }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const clearToast = useCallback(() => setToast(''), []);

  const load = useCallback(async () => {
    try {
      const [board, rules] = await Promise.all([api.leaderboard(), api.rules()]);
      setData({ games: board.categories, troops: board.troops, rules });
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  /** Runs an API call, refreshes the lists and reports. Returns true on success. */
  const act = useCallback(async (fn, success) => {
    setError('');
    try {
      await fn();
      await load();
      if (success) setToast(success);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(err.message);
      return false;
    }
  }, [load, onUnauthorized]);

  const guideColumn = (kind, title, Icon, items, sign, titleClass, rowTone) => (
    <section className={card} aria-labelledby={`${kind}-title`}>
      <h2 id={`${kind}-title`} className={`flex items-center gap-2 font-display text-3xl font-bold ${titleClass}`}>
        <Icon className="size-6" aria-hidden="true" />{title}
      </h2>
      {items.length === 0 && <p className="mt-3 text-muted">None yet. Add one below.</p>}
      <ul className="mt-3 space-y-2">
        {items.map((r) => (
          <Row
            key={r.id ?? r.label}
            label={r.label}
            points={r.points}
            sign={sign}
            tone={rowTone}
            readOnly={r.id === undefined}
            onSave={(label, points) => act(() => api.updateRule(r.id, label, points), `${label} updated.`)}
            onDelete={() => act(() => api.deleteRule(r.id), `${r.label} was removed.`)}
          />
        ))}
      </ul>
      <AddForm placeholder={`New ${kind}, e.g. ${kind === 'merit' ? 'Helping others' : 'Late for activity'}`} withPoints onAdd={(label, points) => act(() => api.createRule(kind, label, points), `${label} added.`)} />
    </section>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-display text-5xl font-extrabold text-pine-900 sm:text-6xl">Games and guide</h1>
      <p className="mt-1 text-muted">Add or change the games, and the merit and demerit shortcuts. The public page and the TV update on their own.</p>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-demerit/10 px-4 py-3 text-sm font-medium text-demerit">{error}</p>}

      {data && [...data.rules.merits, ...data.rules.demerits].some((r) => r.id === undefined) && (
        <p role="alert" className="mt-4 rounded-2xl bg-gold/30 px-4 py-3 text-sm font-medium text-pine-950">
          The guide below is the built-in default and can&apos;t be edited yet, because its database table hasn&apos;t been created.
          Create it once (run <code>npm run db:init</code>, or paste the SQL into Neon), then refresh this page.
        </p>
      )}

      {!data ? (
        <p className="mt-8 text-muted" role="status">{loadError || 'Loading. The first load can take up to a minute.'}</p>
      ) : (
        <div className="mt-6 space-y-6">
          <section className={card} aria-labelledby="games-title">
            <h2 id="games-title" className="flex items-center gap-2 font-display text-3xl font-bold text-pine-900">
              <Flag className="size-6" aria-hidden="true" />Games
            </h2>
            <p className="mt-1 text-sm text-muted">
              These are the games you give points for on the Add points page. Press Scores on a game to correct any troop&apos;s score.
              Deleting a game removes every troop&apos;s score for it. Games scored by judges are managed on the Judging page.
            </p>
            <ul className="mt-3 space-y-2">
              {data.games.map((g) => (
                <Row
                  key={g.id}
                  label={g.name}
                  readOnly={g.judged}
                  scores={g.judged ? null : (
                    <>
                      <p className="mb-2 text-sm text-muted">Type the correct total for each troop and press Save. The change shows in the latest entries, where you can undo it.</p>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {data.troops.map((t) => (
                          <TroopScore
                            key={t.id}
                            troop={t}
                            game={g.name}
                            current={t.games.find((x) => x.categoryId === g.id)?.score ?? 0}
                            onSave={(score) => act(() => api.setGameScore(g.id, t.id, score), `${t.name}: ${g.name} is now ${score}.`)}
                          />
                        ))}
                      </ul>
                    </>
                  )}
                  badge={g.judged ? <span className="rounded-full bg-gold/30 px-2.5 py-0.5 text-xs font-semibold text-pine-950">Judged</span> : null}
                  onSave={(name) => act(() => api.renameGame(g.id, name), `Renamed to ${name}.`)}
                  onDelete={() => act(() => api.deleteGame(g.id), `${g.name} was deleted.`)}
                />
              ))}
            </ul>
            <AddForm placeholder="New game, e.g. Tug of War" onAdd={(name) => act(() => api.createGame(name), `${name} added.`)} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {guideColumn('merit', 'Merits', Award, data.rules.merits, '+', 'text-merit', 'bg-merit/10')}
            {guideColumn('demerit', 'Demerits', ShieldAlert, data.rules.demerits, '\u2212', 'text-demerit', 'bg-demerit/10')}
          </div>
          <p className="text-sm text-muted">Changing the points here only affects awards you give from now on. Points already given stay as they are.</p>
        </div>
      )}

      <Toast message={toast} onClear={clearToast} />
    </main>
  );
}

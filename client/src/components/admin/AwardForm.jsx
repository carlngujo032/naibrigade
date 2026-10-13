import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Check, Flag, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '../../lib/api.js';
import { plain, signed, troopColor } from '../../lib/format.js';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

const KINDS = [
  { id: 'merit', label: 'Merit', Icon: Award },
  { id: 'demerit', label: 'Demerit', Icon: ShieldAlert },
  { id: 'game', label: 'Game score', Icon: Flag },
];

/** A radio input styled as a button. Keyboard arrows and screen readers work natively. */
function Choice({ name, value, checked, onChange, className = '', children }) {
  return (
    <label className="block cursor-pointer">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className={`flex h-full items-center rounded-2xl border-2 border-pine-900/15 bg-white transition-colors hover:border-pine-900/40 peer-checked:border-pine-900 peer-checked:bg-pine-900/5 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold ${className}`}>
        {children}
      </span>
    </label>
  );
}

export default function AwardForm({ troops, categories, rules, onAdded, onUnauthorized }) {
  const [troopId, setTroopId] = useState(null);
  const [kind, setKind] = useState('merit');
  const [categoryId, setCategoryId] = useState(null);
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [preset, setPreset] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const troop = troops.find((t) => t.id === troopId);
  const game = categories.find((c) => c.id === categoryId);
  const presets = kind === 'merit' ? rules?.merits : kind === 'demerit' ? rules?.demerits : null;
  const n = Number(points);
  const validPoints = points !== '' && Number.isInteger(n) && n !== 0 && (kind === 'game' || n > 0);
  const ready = !!troop && validPoints && (kind !== 'game' || !!game);

  const describe = () => {
    if (kind === 'game') return `${signed(n)} in ${game?.name ?? 'a game'}`;
    return `${n} ${kind} points`;
  };
  const buttonLabel = ready
    ? kind === 'game' ? `Add ${signed(n)} in ${game.name} to ${troop.name}` : `Add ${n} ${kind} points to ${troop.name}`
    : 'Add points';

  function chooseKind(next) {
    setKind(next);
    setPoints('');
    setNote('');
    setPreset(null);
    setCategoryId(null);
    setError('');
  }

  function choosePreset(p) {
    setPreset(p.label);
    setPoints(String(p.points));
    setNote(p.label);
  }

  async function submit(e) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.addPoints({ troopId, kind, categoryId: kind === 'game' ? categoryId : undefined, points: n, note: note.trim() || undefined });
      onAdded(`Added ${describe()} to ${troop.name}.`);
      setTroopId(null);
      setPoints('');
      setNote('');
      setPreset(null);
      setCategoryId(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-7 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-pine-900/10 sm:p-7">
      <fieldset>
        <legend className="font-display text-3xl font-bold text-pine-900">Which troop?</legend>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {troops.map((t) => (
            <Choice key={t.id} name="troop" value={t.id} checked={troopId === t.id} onChange={() => setTroopId(t.id)} className="w-full gap-3 px-4 py-3">
              <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: troopColor(t.name, t.id) }} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-display text-2xl font-bold leading-none">{t.name}</span>
                <span className="block text-sm text-muted">{plain(t.total)} points</span>
              </span>
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display text-3xl font-bold text-pine-900">What for?</legend>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {KINDS.map(({ id, label, Icon }) => (
            <Choice key={id} name="kind" value={id} checked={kind === id} onChange={() => chooseKind(id)} className="w-full justify-center gap-2 px-3 py-3 text-sm font-semibold sm:text-base">
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {label}
            </Choice>
          ))}
        </div>
      </fieldset>

      {presets && (
        <fieldset>
          <legend className="text-sm font-semibold text-muted">Quick pick from the guide</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {presets.map((p) => (
              <Choice key={p.label} name="preset" value={p.label} checked={preset === p.label} onChange={() => choosePreset(p)} className="w-full justify-between gap-3 px-4 py-3">
                <span className="font-medium">{p.label}</span>
                <span className={`font-display text-2xl font-bold tabular-nums ${kind === 'merit' ? 'text-merit' : 'text-demerit'}`}>{p.points}</span>
              </Choice>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            Need to add, change or remove one? <Link to="/admin/setup" className="font-semibold text-pine-900 underline">Edit the guide</Link>
          </p>
        </fieldset>
      )}

      {kind === 'game' && (
        <fieldset>
          <legend className="text-sm font-semibold text-muted">Which game?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.filter((c) => !c.judged).map((c) => (
              <Choice key={c.id} name="game" value={c.id} checked={categoryId === c.id} onChange={() => { setCategoryId(c.id); setPreset(null); }} className="w-full justify-center px-3 py-3 text-center font-medium">
                {c.name}
              </Choice>
            ))}
          </div>
        </fieldset>
      )}

      {kind === 'game' && game && rules?.placement && (
        <fieldset>
          <legend className="text-sm font-semibold text-muted">Quick pick by placement</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {rules.placement.scales[rules.placement.games[game.name] ?? 'major']
              .map((pts, i) => ({ label: `${game.name}: ${ORDINALS[i]} place`, short: ORDINALS[i], points: pts }))
              .filter((p) => p.points > 0)
              .map((p) => (
                <Choice key={p.label} name="preset" value={p.label} checked={preset === p.label} onChange={() => choosePreset(p)} className="w-full justify-between gap-3 px-4 py-3">
                  <span className="font-medium">{p.short}</span>
                  <span className="font-display text-2xl font-bold tabular-nums text-pine-900">{p.points}</span>
                </Choice>
              ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <div>
          <label htmlFor="points" className="block text-sm font-semibold">{kind === 'game' ? 'Points scored' : 'Points'}</label>
          <input
            id="points"
            type="number"
            inputMode="numeric"
            step="1"
            value={points}
            onChange={(e) => { setPoints(e.target.value); setPreset(null); }}
            className="mt-1.5 w-full rounded-xl border-2 border-pine-900/20 px-4 py-3 font-display text-3xl font-bold tabular-nums focus:border-pine-900 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="note" className="block text-sm font-semibold">Reason <span className="font-normal text-muted">(optional, shown on the leaderboard)</span></label>
          <input
            id="note"
            type="text"
            maxLength={120}
            value={note}
            onChange={(e) => { setNote(e.target.value); setPreset(null); }}
            className="mt-1.5 w-full rounded-xl border-2 border-pine-900/20 px-4 py-3 text-lg focus:border-pine-900 focus:outline-none"
          />
        </div>
      </div>

      {error && <p role="alert" className="text-sm font-medium text-demerit">{error}</p>}

      <button
        type="submit"
        disabled={!ready || busy}
        className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${kind === 'demerit' ? 'bg-demerit hover:bg-demerit/90' : 'bg-pine-900 hover:bg-pine-800'}`}
      >
        <Check className="size-5" aria-hidden="true" />
        {busy ? 'Adding' : buttonLabel}
      </button>
    </form>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Gavel, KeyRound, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api.js';
import { usePolling } from '../../lib/usePolling.js';
import ConfirmButton from '../ConfirmButton.jsx';
import Toast from '../Toast.jsx';

const card = 'rounded-3xl bg-white p-5 shadow-sm ring-1 ring-pine-900/10 sm:p-6';
const inputBase = 'rounded-xl border-2 border-pine-900/20 px-4 py-2.5 text-lg focus:border-pine-900 focus:outline-none';
const input = `w-full ${inputBase}`;
const primaryBtn = 'rounded-full bg-pine-900 px-5 py-2.5 font-semibold text-white hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-40';
const quietBtn = 'rounded-full bg-pine-900/10 px-4 py-2 text-sm font-semibold text-pine-900 hover:bg-pine-900/20 disabled:opacity-40';

const SAMPLES = {
  'Flag Making': [
    { name: 'Creativity and Originality', max: '25' },
    { name: 'Relevance to Theme / Symbolism', max: '20' },
    { name: 'Neatness and Craftsmanship', max: '20' },
    { name: 'Team Effort and Participation', max: '15' },
    { name: 'Presentation and Explanation', max: '10' },
    { name: 'Overall Impact', max: '10' },
  ],
  'Yell': [
    { name: 'Unity and Coordination', max: '25' },
    { name: 'Creativity and Originality', max: '20' },
    { name: 'Clarity and Delivery', max: '15' },
    { name: 'Relevance to Camp Theme', max: '15' },
    { name: 'Spirit and Enthusiasm', max: '15' },
    { name: 'Costume and Presentation', max: '10' },
  ],
  'Trashion Show': [
    { name: 'Creativity and Originality', max: '30' },
    { name: 'Use of Recycled / Repurposed Materials', max: '25' },
    { name: 'Craftsmanship / Construction', max: '20' },
    { name: 'Visual Impact / Stage Presence', max: '15' },
    { name: 'Sustainability Story / Concept', max: '10' },
  ],
  'Whistle Game': [
    { name: 'Accuracy of Formation', max: '30' },
    { name: 'Speed and Response to Commands', max: '20' },
    { name: 'Teamwork and Coordination', max: '20' },
    { name: 'Discipline and Orderliness', max: '15' },
    { name: 'Execution and Overall Performance', max: '15' },
  ],
  'Cultural Dance': [
    { name: 'Cultural Authenticity and Representation', max: '25' },
    { name: 'Dance Execution and Choreography', max: '20' },
    { name: 'Costume and Props', max: '15' },
    { name: 'Creativity and Stage Presentation', max: '15' },
    { name: 'Musicality and Rhythm', max: '10' },
    { name: 'Audience Impact and Overall Performance', max: '10' },
    { name: 'Values of Unity and Cultural Appreciation', max: '5' },
  ],
};

const STATUS = {
  draft: ['Draft, hidden from judges', 'bg-pine-900/10 text-muted'],
  open: ['Open for judging', 'bg-gold/30 text-pine-950'],
  published: ['Published on the leaderboard', 'bg-merit/15 text-merit'],
};

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`${quietBtn} flex items-center gap-1.5`}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* clipboard blocked */ }
      }}
    >
      {done ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {done ? 'Copied' : label}
    </button>
  );
}

/* ------------------------------------------------------------------ judges */

function JudgesCard({ judges, revealed, onDismiss, onAdd, onReset, onDelete }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const loginUrl = `${window.location.origin}/judge`;

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    const ok = await onAdd(name.trim());
    if (ok) setName('');
    setBusy(false);
  }

  return (
    <section aria-labelledby="judges-title" className={card}>
      <h2 id="judges-title" className="font-display text-3xl font-bold text-pine-900">Judges</h2>
      <p className="mt-1 text-sm text-muted">Each judge signs in with their own code at <span className="font-semibold text-ink">{loginUrl}</span></p>
      <div className="mt-2"><CopyButton text={loginUrl} label="Copy judge link" /></div>

      {revealed && (
        <div className="mt-4 rounded-2xl bg-gold/25 p-4" role="status">
          <p className="font-semibold">Code for {revealed.name}</p>
          <p className="my-1 select-all font-display text-4xl font-extrabold tracking-[0.18em]">{revealed.code}</p>
          <p className="text-sm">Give this to {revealed.name} now. It is shown only once. If it gets lost, use Reset code.</p>
          <div className="mt-3 flex gap-2">
            <CopyButton text={revealed.code} label="Copy code" />
            <button type="button" onClick={onDismiss} className={quietBtn}>Done</button>
          </div>
        </div>
      )}

      {judges.length === 0 ? (
        <p className="mt-4 text-muted">No judges yet. Add the first one below.</p>
      ) : (
        <ul className="mt-4 divide-y divide-pine-900/10">
          {judges.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="font-semibold">{j.name}</span>
              <span className="flex gap-2">
                <ConfirmButton Icon={KeyRound} label="Reset code" confirmLabel="Confirm reset" onConfirm={() => onReset(j)} />
                <ConfirmButton Icon={Trash2} label="Remove" confirmLabel="Confirm remove" onConfirm={() => onDelete(j)} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-4 flex gap-2">
        <label htmlFor="judge-name" className="sr-only">Judge name</label>
        <input id="judge-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Judge name, e.g. Ms. Santos" className={input} />
        <button type="submit" disabled={!name.trim() || busy} className={`${primaryBtn} flex shrink-0 items-center gap-2`}>
          <UserPlus className="size-4" aria-hidden="true" />Add
        </button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------- criteria rows (shared) */

function CriteriaRows({ rows, setRows, lockStructure = false }) {
  const total = rows.reduce((s, c) => s + (Number(c.max) || 0), 0);
  const setRow = (i, patch) => setRows((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 px-1 text-xs font-semibold text-muted" aria-hidden="true">
          <span className="min-w-0 flex-1">Criterion name</span>
          <span className="w-24 shrink-0 text-right">Points</span>
          <span className="w-9 shrink-0" />
        </div>
        {rows.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input aria-label={`Criterion ${i + 1} name`} value={c.name} onChange={(e) => setRow(i, { name: e.target.value })} maxLength={100} placeholder="Criterion name" className={`${inputBase} min-w-0 flex-1`} />
            <input aria-label={`Criterion ${i + 1} points`} type="number" inputMode="numeric" min="1" max="1000" value={c.max} onChange={(e) => setRow(i, { max: e.target.value })} placeholder="Points" className={`${inputBase} w-24 shrink-0 text-right`} />
            {lockStructure ? (
              <span className="w-9 shrink-0" />
            ) : (
              <button type="button" onClick={() => setRows((list) => list.filter((_, idx) => idx !== i))} disabled={rows.length === 1} aria-label={`Remove criterion ${i + 1}`} className="w-9 shrink-0 rounded-full p-2 text-muted hover:bg-pine-900/10 disabled:opacity-30">
                <X className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        {lockStructure ? (
          <p className="text-sm text-muted">Judges already started scoring, so criteria can be renamed or re-pointed but not added or removed.</p>
        ) : (
          <button type="button" onClick={() => setRows((list) => [...list, { name: '', max: '' }])} disabled={rows.length >= 12} className={`${quietBtn} flex items-center gap-1.5`}>
            <Plus className="size-4" aria-hidden="true" />Add criterion
          </button>
        )}
        <p className="shrink-0 font-display text-2xl font-bold text-pine-900">{total} points total</p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ new event form */

function NewEventForm({ judges, prefill, onCreate, onCancel }) {
  const [name, setName] = useState(prefill?.name ?? '');
  const [criteria, setCriteria] = useState(prefill?.criteria ?? [{ name: '', max: '' }]);
  const [judgeIds, setJudgeIds] = useState(() => new Set(prefill?.judgeIds ?? judges.map((j) => j.id)));
  const [busy, setBusy] = useState(false);

  const valid = name.trim() && judgeIds.size > 0
    && criteria.every((c) => c.name.trim() && Number.isInteger(Number(c.max)) && Number(c.max) >= 1);

  const toggleJudge = (id) => setJudgeIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const ok = await onCreate({
      name: name.trim(),
      criteria: criteria.map((c) => ({ name: c.name.trim(), max: Number(c.max) })),
      judgeIds: [...judgeIds],
    });
    setBusy(false);
    if (ok) onCancel();
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-5`} aria-labelledby="new-event-title">
      <h2 id="new-event-title" className="font-display text-3xl font-bold text-pine-900">New judged event</h2>

      <div>
        <label htmlFor="event-name" className="block text-sm font-semibold">Event name</label>
        <input id="event-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Mr. Brigade" className={`${input} mt-1.5`} autoFocus />
        <p className="mt-1 text-sm text-muted">This also becomes a game on the leaderboard.</p>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Criteria and their maximum points</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(SAMPLES).map(([label, rows]) => (
            <button key={label} type="button" onClick={() => setCriteria(rows.map((r) => ({ ...r })))} className={quietBtn}>{label}</button>
          ))}
        </div>
        <CriteriaRows rows={criteria} setRows={setCriteria} />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Judges for this event</legend>
        {judges.length === 0 ? (
          <p className="mt-2 text-muted">Add a judge first (see the Judges card).</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {judges.map((j) => (
              <label key={j.id} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-pine-900/15 px-4 py-2.5 has-[:checked]:border-pine-900 has-[:checked]:bg-pine-900/5">
                <input type="checkbox" checked={judgeIds.has(j.id)} onChange={() => toggleJudge(j.id)} className="size-5 accent-pine-900" />
                <span className="font-medium">{j.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex gap-3">
        <button type="submit" disabled={!valid || busy} className={primaryBtn}>{busy ? 'Creating' : 'Create event'}</button>
        <button type="button" onClick={onCancel} className={quietBtn}>Cancel</button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------- event editor */

function EventEditor({ event, hasScores, onSave, onCancel }) {
  const [name, setName] = useState(event.name);
  const [rows, setRows] = useState(() => event.criteria.map((c) => ({ id: c.id, name: c.name, max: String(c.max) })));
  const [busy, setBusy] = useState(false);

  const valid = name.trim() && rows.every((c) => c.name.trim() && Number.isInteger(Number(c.max)) && Number(c.max) >= 1);

  async function submit(e) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onSave({
      name: name.trim(),
      criteria: rows.map((c) => ({ id: c.id, name: c.name.trim(), max: Number(c.max) })),
    });
    setBusy(false);
    if (ok) onCancel();
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-5`} aria-labelledby={`edit-${event.id}`}>
      <h3 id={`edit-${event.id}`} className="font-display text-3xl font-bold text-pine-900">Edit {event.name}</h3>
      <div>
        <label htmlFor={`edit-name-${event.id}`} className="block text-sm font-semibold">Event name</label>
        <input id={`edit-name-${event.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={`${input} mt-1.5`} autoFocus />
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Criteria and their points</legend>
        <CriteriaRows rows={rows} setRows={setRows} lockStructure={hasScores} />
      </fieldset>
      <div className="flex gap-3">
        <button type="submit" disabled={!valid || busy} className={primaryBtn}>{busy ? 'Saving' : 'Save changes'}</button>
        <button type="button" onClick={onCancel} className={quietBtn}>Cancel</button>
      </div>
    </form>
  );
}

/* --------------------------------------------------------------- event card */

function EventCard({ event, allJudges, act, onDuplicate }) {
  const [editing, setEditing] = useState(false);
  const [editJudges, setEditJudges] = useState(false);
  const [picked, setPicked] = useState(() => new Set(event.judges.map((j) => j.id)));
  const submitted = event.judges.filter((j) => j.submitted).length;
  const [label, tone] = STATUS[event.status];
  const hasScores = event.judges.some((j) => j.filled > 0);
  const sorted = [...event.results].sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.name.localeCompare(b.name));

  if (editing) {
    return (
      <EventEditor
        event={event}
        hasScores={hasScores}
        onCancel={() => setEditing(false)}
        onSave={async (body) => !!(await act(() => api.updateEvent(event.id, body), `${body.name} updated.`))}
      />
    );
  }

  return (
    <article className={card} aria-labelledby={`ev-${event.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 id={`ev-${event.id}`} className="font-display text-4xl font-extrabold leading-none text-pine-900">{event.name}</h3>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={event.status === 'published'}
              aria-label={`Edit ${event.name}`}
              title={event.status === 'published' ? 'Reopen scoring to edit' : 'Edit name and criteria'}
              className="rounded-full p-2 text-muted hover:bg-pine-900/10 disabled:opacity-30"
            >
              <Pencil className="size-5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-muted">{event.criteria.length} criteria, {event.maxTotal} points possible</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tone}`}>{label}</span>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Criteria">
        {event.criteria.map((c) => (
          <li key={c.id} className="rounded-full bg-pine-900/5 px-3 py-1 text-sm">{c.name} <span className="font-bold">{c.max}</span></li>
        ))}
      </ul>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left">
          <caption className="pb-1 text-left text-sm font-semibold text-muted">Judges</caption>
          <tbody>
            {event.judges.map((j) => (
              <tr key={j.id} className="border-t border-pine-900/10">
                <th scope="row" className="py-2 pr-3 font-medium">{j.name}</th>
                <td className="py-2 pr-3 text-sm text-muted tabular-nums">{j.filled} of {event.required} scores</td>
                <td className="py-2 pr-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${j.submitted ? 'bg-merit/15 text-merit' : 'bg-pine-900/10 text-muted'}`}>{j.submitted ? 'Submitted' : 'Scoring'}</span>
                </td>
                <td className="py-2 text-right">
                  {j.submitted && event.status !== 'published' && (
                    <ConfirmButton label="Allow edit" confirmLabel="Confirm" onConfirm={() => act(() => api.reopenJudge(event.id, j.id), `${j.name} can edit again.`)} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasScores && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-left">
            <caption className="pb-1 text-left text-sm font-semibold text-muted">Totals so far (only submitted scores count in the average)</caption>
            <thead>
              <tr className="border-b-2 border-pine-900/15 text-sm text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">Troop</th>
                {event.judges.map((j) => <th key={j.id} scope="col" className="px-2 py-2 text-right font-semibold">{j.name}</th>)}
                <th scope="col" className="px-2 py-2 text-right font-semibold">Average</th>
                <th scope="col" className="py-2 pl-2 text-right font-semibold">Points</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.troopId} className="border-b border-pine-900/10">
                  <th scope="row" className="py-2 pr-3 font-display text-xl font-bold">{r.name}</th>
                  {event.judges.map((j) => {
                    const v = r.totals[j.id];
                    return <td key={j.id} className={`px-2 py-2 text-right tabular-nums ${j.submitted ? '' : 'text-muted italic'}`}>{v ?? '–'}</td>;
                  })}
                  <td className="px-2 py-2 text-right tabular-nums">{r.average ?? '–'}</td>
                  <td className="py-2 pl-2 text-right font-display text-2xl font-extrabold tabular-nums text-pine-900">{r.average === null ? '–' : r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editJudges && (
        <div className="mt-5 rounded-2xl bg-pine-900/5 p-4">
          <p className="text-sm font-semibold">Judges for this event</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {allJudges.map((j) => (
              <label key={j.id} className="flex items-center gap-3 rounded-xl bg-white px-4 py-2.5">
                <input type="checkbox" className="size-5 accent-pine-900" checked={picked.has(j.id)}
                  onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(j.id)) n.delete(j.id); else n.add(j.id); return n; })} />
                <span className="font-medium">{j.name}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">Removing a judge also removes the scores they entered for this event.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={picked.size === 0} className={primaryBtn}
              onClick={async () => { if (await act(() => api.setEventJudges(event.id, [...picked]), 'Judges updated.')) setEditJudges(false); }}>Save judges</button>
            <button type="button" className={quietBtn} onClick={() => setEditJudges(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-pine-900/10 pt-5">
        {event.status === 'draft' && (
          <button type="button" className={primaryBtn} onClick={() => act(() => api.setEventStatus(event.id, 'open'), `${event.name} is open for judging.`)}>Open for judging</button>
        )}
        {event.status === 'open' && (
          <>
            <ConfirmButton primary Icon={Gavel} label="Publish results" confirmLabel="Confirm: show on leaderboard" disabled={submitted === 0}
              onConfirm={() => act(() => api.setEventStatus(event.id, 'published'), `${event.name} is now on the leaderboard.`)} />
            <button type="button" className={quietBtn} onClick={() => act(() => api.setEventStatus(event.id, 'draft'), `${event.name} is hidden from judges.`)}>Back to draft</button>
            <p className="text-sm text-muted">{submitted} of {event.judges.length} judges submitted{submitted === 0 ? '. Publishing needs at least one.' : '. Only submitted scores count.'}</p>
          </>
        )}
        {event.status === 'published' && (
          <>
            <ConfirmButton label="Reopen scoring" confirmLabel="Confirm: remove from leaderboard" onConfirm={() => act(() => api.setEventStatus(event.id, 'open'), `${event.name} is open again and no longer counts.`)} />
            <p className="text-sm text-muted">Counted on the public leaderboard and TV view.</p>
          </>
        )}

        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={quietBtn} disabled={event.status === 'published'} onClick={() => setEditJudges((v) => !v)}>Change judges</button>
          <button type="button" className={quietBtn} onClick={() => onDuplicate(event)}>Copy as new event</button>
          <ConfirmButton Icon={Trash2} label="Delete" confirmLabel="Confirm delete" onConfirm={() => act(() => api.deleteEvent(event.id), `${event.name} was deleted.`)} />
        </span>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------- panel */

export default function JudgingPanel({ onUnauthorized }) {
  const overview = usePolling(() => api.judging(), 10_000);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(null);
  const [form, setForm] = useState(null); // null = hidden, otherwise { key, prefill }
  const clearToast = useCallback(() => setToast(''), []);

  useEffect(() => {
    if (overview.error?.status === 401) onUnauthorized();
  }, [overview.error, onUnauthorized]);

  /** Runs an API call, refreshes, and reports. Returns the result, or undefined if it failed. */
  const act = useCallback(async (fn, success) => {
    setError('');
    try {
      const result = (await fn()) ?? true;
      await overview.refresh();
      if (success) setToast(success);
      return result;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(err.message);
      return undefined;
    }
  }, [overview, onUnauthorized]);

  const data = overview.data;

  const addJudge = async (name) => {
    const res = await act(() => api.createJudge(name));
    if (res) setRevealed({ name: res.name, code: res.code });
    return !!res;
  };
  const resetJudge = async (j) => {
    const res = await act(() => api.resetJudgeCode(j.id));
    if (res) setRevealed({ name: j.name, code: res.code });
  };
  const duplicate = (e) => setForm({
    key: Date.now(),
    prefill: { name: '', criteria: e.criteria.map((c) => ({ name: c.name, max: String(c.max) })), judgeIds: e.judges.map((j) => j.id) },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-display text-5xl font-extrabold text-pine-900 sm:text-6xl">Judging</h1>
      <p className="mt-1 text-muted">For events scored by judges, like Mr. and Ms. or flag making. Results only count once you publish them.</p>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-demerit/10 px-4 py-3 text-sm font-medium text-demerit">{error}</p>}

      {!data ? (
        <p className="mt-8 text-muted" role="status">{overview.error ? overview.error.message : 'Loading. The first load can take up to a minute.'}</p>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <div className="order-last space-y-6 lg:order-first">
            {form ? (
              <NewEventForm
                key={form.key}
                judges={data.judges}
                prefill={form.prefill}
                onCancel={() => setForm(null)}
                onCreate={async (body) => !!(await act(() => api.createEvent(body), `${body.name} created. Open it for judging when you are ready.`))}
              />
            ) : (
              <button type="button" onClick={() => setForm({ key: Date.now(), prefill: null })} disabled={data.judges.length === 0} className={`${primaryBtn} flex items-center gap-2`}>
                <Plus className="size-5" aria-hidden="true" />New judged event
              </button>
            )}
            {data.judges.length === 0 && !form && <p className="-mt-3 text-sm text-muted">Add a judge first, then you can create an event.</p>}

            {data.events.length === 0 ? (
              <p className={`${card} text-muted`}>No judged events yet.</p>
            ) : (
              data.events.map((e) => <EventCard key={e.id} event={e} allJudges={data.judges} act={act} onDuplicate={duplicate} />)
            )}
          </div>

          <div className="order-first lg:sticky lg:top-4 lg:order-last">
            <JudgesCard judges={data.judges} revealed={revealed} onDismiss={() => setRevealed(null)} onAdd={addJudge} onReset={resetJudge} onDelete={(j) => act(() => api.deleteJudge(j.id), `${j.name} was removed.`)} />
          </div>
        </div>
      )}

      <Toast message={toast} onClear={clearToast} />
    </main>
  );
}

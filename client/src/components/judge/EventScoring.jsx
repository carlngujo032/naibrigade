import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, Lock, TriangleAlert } from 'lucide-react';
import { api, ApiError } from '../../lib/api.js';
import { troopColor } from '../../lib/format.js';

const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

export default function EventScoring({ event, troops, onSubmitted, onUnauthorized }) {
  // Local copy of this judge's scores. Seeded once, so background refreshes never overwrite typing.
  const [values, setValues] = useState(() => {
    const init = {};
    for (const t of troops) {
      init[t.id] = {};
      for (const c of event.criteria) init[t.id][c.id] = event.scores?.[t.id]?.[c.id] ?? '';
    }
    return init;
  });
  const [status, setStatus] = useState({}); // troopId -> 'saving' | 'saved' | 'error'
  const [errors, setErrors] = useState({}); // `${troopId}:${criterionId}` -> message
  const [submitError, setSubmitError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(new Set());
  const versions = useRef({}); // troopId -> edit counter, so a slow save never hides a newer edit

  const editable = event.status === 'open' && !event.submitted;
  const maxTotal = event.criteria.reduce((s, c) => s + c.max, 0);
  const required = troops.length * event.criteria.length;

  const validate = (c, raw) => {
    if (blank(raw)) return '';
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 'Enter a number from 0 up';
    if (n > c.max) return `Too high. The most you can give is ${c.max}. Please change it.`;
    return '';
  };

  const filled = useMemo(
    () => troops.reduce((sum, t) => sum + event.criteria.filter((c) => !blank(values[t.id]?.[c.id]) && !validate(c, values[t.id][c.id])).length, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values, troops, event.criteria],
  );
  const errorCount = Object.values(errors).filter(Boolean).length;
  const hasErrors = errorCount > 0;
  const totalFor = (t) => event.criteria.reduce((s, c) => {
    const v = values[t.id]?.[c.id];
    return s + (blank(v) || validate(c, v) ? 0 : Number(v));
  }, 0);

  function change(troopId, c, raw) {
    setValues((v) => ({ ...v, [troopId]: { ...v[troopId], [c.id]: raw } }));
    setErrors((e) => ({ ...e, [`${troopId}:${c.id}`]: validate(c, raw) }));
    dirty.current.add(troopId);
    versions.current[troopId] = (versions.current[troopId] ?? 0) + 1;
    setStatus((s) => ({ ...s, [troopId]: undefined }));
  }

  async function saveTroop(troopId) {
    const row = values[troopId];
    if (event.criteria.some((c) => validate(c, row[c.id]))) return false;
    const payload = Object.fromEntries(event.criteria.map((c) => [c.id, blank(row[c.id]) ? null : Number(row[c.id])]));
    const version = versions.current[troopId] ?? 0;
    setStatus((s) => ({ ...s, [troopId]: 'saving' }));
    try {
      await api.judgeSaveScores(event.id, troopId, payload);
      // Only mark clean if nothing was edited while this save was on its way.
      if ((versions.current[troopId] ?? 0) === version) {
        dirty.current.delete(troopId);
        setStatus((s) => ({ ...s, [troopId]: 'saved' }));
      }
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      setStatus((s) => ({ ...s, [troopId]: 'error' }));
      setSubmitError(err.message);
      return false;
    }
  }

  const onBlur = (troopId) => { if (dirty.current.has(troopId)) saveTroop(troopId); };

  async function submit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      // Save every troop once more before submitting, so the server always matches what is on screen.
      for (const t of troops) {
        if (!(await saveTroop(t.id))) throw new Error('One of your scores could not be saved. Check it and try again.');
      }
      await api.judgeSubmit(event.id);
      setConfirming(false);
      await onSubmitted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = editable && filled === required && !hasErrors && !submitting;

  return (
    <section aria-labelledby="scoring-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="scoring-title" className="font-display text-4xl font-extrabold text-pine-900 sm:text-5xl">{event.name}</h2>
          <p className="text-muted">Score every troop on each criterion. Your scores save as you go.</p>
        </div>
        <p className="font-display text-2xl font-bold text-pine-900">{maxTotal} points possible</p>
      </div>

      {event.submitted && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-merit/10 px-4 py-3 font-medium text-merit">
          <Lock className="size-5 shrink-0" aria-hidden="true" />
          You submitted your scores. Ask the organizer if you need to change something.
        </p>
      )}
      {event.status === 'published' && !event.submitted && (
        <p className="mt-4 rounded-2xl bg-pine-900/10 px-4 py-3 font-medium">Scoring for this event is closed.</p>
      )}

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {troops.map((t) => {
          const color = troopColor(t.name, t.id);
          const st = status[t.id];
          const troopHasError = event.criteria.some((c) => errors[`${t.id}:${c.id}`]);
          return (
            <fieldset key={t.id} disabled={!editable} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-pine-900/10">
              <div className="h-2" style={{ backgroundColor: color }} aria-hidden="true" />
              <div className="p-5">
                <legend className="sr-only">{t.name}</legend>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-3xl font-bold leading-none">{t.name}</h3>
                  <p className="font-display text-3xl font-extrabold tabular-nums text-pine-900">
                    {fmt(totalFor(t))}<span className="text-xl font-bold text-muted"> / {maxTotal}</span>
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {event.criteria.map((c) => {
                    const key = `${t.id}:${c.id}`;
                    const id = `s-${key}`;
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between gap-3">
                          <label htmlFor={id} className="min-w-0 flex-1 font-medium leading-snug">
                            {c.name} <span className="whitespace-nowrap text-sm font-normal text-muted">(max {c.max})</span>
                          </label>
                          <input
                            id={id}
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min="0"
                            max={c.max}
                            value={values[t.id][c.id]}
                            onChange={(e) => change(t.id, c, e.target.value)}
                            onBlur={() => onBlur(t.id)}
                            aria-invalid={!!errors[key]}
                            aria-describedby={errors[key] ? `${id}-err` : undefined}
                            className={`w-24 rounded-xl border-2 px-3 py-2 text-right font-display text-3xl font-bold tabular-nums focus:outline-none disabled:bg-pine-900/5 disabled:text-ink ${errors[key] ? 'border-demerit bg-demerit/10 text-demerit' : 'border-pine-900/20 focus:border-pine-900'}`}
                          />
                        </div>
                        {errors[key] && <p id={`${id}-err`} className="mt-1 text-right text-sm font-medium text-demerit">{errors[key]}</p>}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3 flex h-5 items-center justify-end gap-1.5 text-sm text-muted" aria-live="polite">
                  {troopHasError && <><TriangleAlert className="size-4 text-demerit" aria-hidden="true" /><span className="font-semibold text-demerit">Not saved. Fix the red score.</span></>}
                  {!troopHasError && st === 'saving' && <><LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />Saving</>}
                  {!troopHasError && st === 'saved' && <><CheckCircle2 className="size-4 text-merit" aria-hidden="true" />Saved</>}
                  {!troopHasError && st === 'error' && <><TriangleAlert className="size-4 text-demerit" aria-hidden="true" />Not saved</>}
                </p>
              </div>
            </fieldset>
          );
        })}
      </div>

      {editable && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-pine-900/10 bg-field/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-3xl sm:border sm:bg-white sm:px-6">
          {hasErrors && (
            <p role="alert" className="mb-3 flex items-start gap-2 rounded-2xl bg-demerit/10 px-4 py-3 font-semibold text-demerit">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              {errorCount === 1 ? '1 score is above its maximum' : `${errorCount} scores are above their maximum`}. Change {errorCount === 1 ? 'it' : 'them'} (shown in red) before you can submit.
            </p>
          )}
          {confirming ? (
            <div>
              <p className="font-semibold">Submit your scores for {event.name}?</p>
              <p className="text-sm text-muted">You will not be able to change them afterwards unless the organizer reopens it.</p>
              <div className="mt-3 flex gap-3">
                <button type="button" onClick={submit} disabled={submitting} className="flex-1 rounded-full bg-pine-900 px-6 py-3 font-semibold text-white hover:bg-pine-800 disabled:opacity-50">
                  {submitting ? 'Submitting' : 'Yes, submit'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={submitting} className="rounded-full bg-pine-900/10 px-6 py-3 font-semibold hover:bg-pine-900/20">
                  Keep editing
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium" aria-live="polite">{filled} of {required} scores entered</p>
              <button
                type="button"
                onClick={() => { setSubmitError(''); setConfirming(true); }}
                disabled={!canSubmit}
                className="rounded-full bg-pine-900 px-6 py-3 font-semibold text-white hover:bg-pine-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit final scores
              </button>
            </div>
          )}
          {submitError && <p role="alert" className="mt-2 text-sm font-medium text-demerit">{submitError}</p>}
        </div>
      )}
    </section>
  );
}

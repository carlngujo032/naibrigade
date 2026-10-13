import { Crown } from 'lucide-react';
import { plain, signed, troopColor } from '../lib/format.js';

export default function GameMatrix({ troops, categories }) {
  const best = Object.fromEntries(
    categories.map((c) => [
      c.id,
      Math.max(...troops.map((t) => t.games.find((g) => g.categoryId === c.id)?.score ?? 0)),
    ]),
  );

  return (
    <section aria-labelledby="games-title" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-pine-900/10 sm:p-6">
      <h2 id="games-title" className="font-display text-3xl font-bold text-pine-900">Scores by game</h2>
      <p className="mt-1 text-sm text-muted">Best score in each game is highlighted. Troops are ordered by total.</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-pine-900/15">
              <th scope="col" className="sticky left-0 bg-white py-2 pr-3 text-sm font-semibold text-muted">Game</th>
              {troops.map((t) => (
                <th key={t.id} scope="col" className="px-3 py-2 text-right font-display text-xl font-bold">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ backgroundColor: troopColor(t.name, t.id) }} aria-hidden="true" />
                    {t.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-pine-900/10">
                <th scope="row" className="sticky left-0 bg-white py-3 pr-3 text-base font-medium">{c.name}</th>
                {troops.map((t) => {
                  const score = t.games.find((g) => g.categoryId === c.id)?.score ?? 0;
                  const wins = score > 0 && score === best[c.id];
                  return (
                    <td
                      key={t.id}
                      className={`px-3 py-3 text-right text-lg tabular-nums ${wins ? 'font-bold' : 'text-ink/80'}`}
                      style={wins ? { backgroundColor: `${troopColor(t.name, t.id)}26` } : undefined}
                    >
                      {wins && <Crown className="mr-1.5 inline size-4 align-[-2px]" aria-label="Best score" />}
                      {plain(score)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-b border-pine-900/10">
              <th scope="row" className="sticky left-0 bg-white py-3 pr-3 text-base font-medium text-merit">Merit</th>
              {troops.map((t) => <td key={t.id} className="px-3 py-3 text-right text-lg tabular-nums text-merit">{signed(t.merit)}</td>)}
            </tr>
            <tr className="border-b border-pine-900/10">
              <th scope="row" className="sticky left-0 bg-white py-3 pr-3 text-base font-medium text-demerit">Demerit</th>
              {troops.map((t) => <td key={t.id} className="px-3 py-3 text-right text-lg tabular-nums text-demerit">{t.demerit ? signed(-t.demerit) : '0'}</td>)}
            </tr>
            <tr>
              <th scope="row" className="sticky left-0 bg-white py-4 pr-3 font-display text-2xl font-bold text-pine-900">Total</th>
              {troops.map((t) => <td key={t.id} className="px-3 py-4 text-right font-display text-3xl font-extrabold tabular-nums text-pine-900">{plain(t.total)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

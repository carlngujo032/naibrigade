import { pool } from './db.js';
import { getPlacementScale } from './guide.js';
import { placementPoints } from './rules.js';

const num = (v) => (v === null || v === undefined ? null : Number(v));
const round2 = (n) => Math.round(n * 100) / 100;

/** Everything the organizer's Judging page needs, in one go. */
export async function getJudgingOverview() {
  const [judges, events, criteria, assigned, subs, filled, totals, troops, scale] = await Promise.all([
    pool.query('SELECT judge_id, name FROM judges ORDER BY judge_id'),
    pool.query('SELECT event_id, name, status, category_id FROM events ORDER BY event_id'),
    pool.query('SELECT criterion_id, event_id, name, max_points FROM event_criteria ORDER BY event_id, sort_order, criterion_id'),
    pool.query('SELECT event_id, judge_id FROM event_judges'),
    pool.query('SELECT event_id, judge_id FROM judge_submissions'),
    pool.query('SELECT event_id, judge_id, COUNT(*)::int AS n FROM judge_scores GROUP BY event_id, judge_id'),
    pool.query('SELECT event_id, troop_id, judge_id, SUM(score) AS total FROM judge_scores GROUP BY event_id, troop_id, judge_id'),
    pool.query('SELECT troop_id, troop_name FROM troops ORDER BY troop_id'),
    getPlacementScale(),
  ]);

  const judgeName = new Map(judges.rows.map((j) => [j.judge_id, j.name]));

  const eventList = events.rows.map((e) => {
    const crit = criteria.rows.filter((c) => c.event_id === e.event_id)
      .map((c) => ({ id: c.criterion_id, name: c.name, max: c.max_points }));
    const required = crit.length * troops.rows.length;
    const eventJudges = assigned.rows.filter((a) => a.event_id === e.event_id).map((a) => a.judge_id);

    const judgeRows = eventJudges.map((id) => ({
      id,
      name: judgeName.get(id),
      submitted: subs.rows.some((s) => s.event_id === e.event_id && s.judge_id === id),
      filled: filled.rows.find((f) => f.event_id === e.event_id && f.judge_id === id)?.n ?? 0,
    }));
    const submittedIds = new Set(judgeRows.filter((j) => j.submitted).map((j) => j.id));

    const results = troops.rows.map((t) => {
      const perJudge = {};
      for (const id of eventJudges) {
        const row = totals.rows.find((x) => x.event_id === e.event_id && x.troop_id === t.troop_id && x.judge_id === id);
        perJudge[id] = row ? round2(num(row.total)) : null;
      }
      const counted = [...submittedIds].map((id) => perJudge[id]).filter((v) => v !== null);
      const average = counted.length ? round2(counted.reduce((a, b) => a + b, 0) / counted.length) : null;
      return { troopId: t.troop_id, name: t.troop_name, totals: perJudge, average, points: average === null ? 0 : Math.round(average) };
    });

    // Show placement points here, the same as the leaderboard will.
    const placed = placementPoints(results.map((r) => ({ id: r.troopId, average: r.average })), scale);
    for (const r of results) r.points = placed.get(r.troopId);

    return {
      id: e.event_id,
      name: e.name,
      status: e.status,
      categoryId: e.category_id,
      criteria: crit,
      maxTotal: crit.reduce((s, c) => s + c.max, 0),
      required,
      judges: judgeRows,
      results,
    };
  });

  return { judges: judges.rows.map((j) => ({ id: j.judge_id, name: j.name })), events: eventList };
}

/** What one judge sees: their events, the troops, and the scores they already entered. */
export async function getJudgeWorkspace(judgeId) {
  const [judge, events, troops] = await Promise.all([
    pool.query('SELECT name FROM judges WHERE judge_id = $1', [judgeId]),
    pool.query(
      `SELECT e.event_id, e.name, e.status
       FROM events e JOIN event_judges ej ON ej.event_id = e.event_id
       WHERE ej.judge_id = $1 AND e.status IN ('open', 'published')
       ORDER BY e.event_id`,
      [judgeId],
    ),
    pool.query('SELECT troop_id, troop_name FROM troops ORDER BY troop_id'),
  ]);
  if (!judge.rowCount) return null;

  const ids = events.rows.map((e) => e.event_id);
  const [criteria, scores, subs] = ids.length
    ? await Promise.all([
        pool.query('SELECT criterion_id, event_id, name, max_points FROM event_criteria WHERE event_id = ANY($1) ORDER BY event_id, sort_order, criterion_id', [ids]),
        pool.query('SELECT event_id, troop_id, criterion_id, score FROM judge_scores WHERE judge_id = $1 AND event_id = ANY($2)', [judgeId, ids]),
        pool.query('SELECT event_id FROM judge_submissions WHERE judge_id = $1 AND event_id = ANY($2)', [judgeId, ids]),
      ])
    : [{ rows: [] }, { rows: [] }, { rows: [] }];

  return {
    judge: { name: judge.rows[0].name },
    troops: troops.rows.map((t) => ({ id: t.troop_id, name: t.troop_name })),
    events: events.rows.map((e) => {
      const mine = {};
      for (const s of scores.rows.filter((r) => r.event_id === e.event_id)) {
        (mine[s.troop_id] ??= {})[s.criterion_id] = num(s.score);
      }
      return {
        id: e.event_id,
        name: e.name,
        status: e.status,
        submitted: subs.rows.some((s) => s.event_id === e.event_id),
        criteria: criteria.rows.filter((c) => c.event_id === e.event_id).map((c) => ({ id: c.criterion_id, name: c.name, max: c.max_points })),
        scores: mine,
      };
    }),
  };
}

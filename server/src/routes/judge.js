import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { HttpError, pool } from '../db.js';
import { hashJudgeCode, requireJudge, signToken } from '../auth.js';
import { getJudgeWorkspace } from '../judging.js';

export const judgeRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a few minutes and try again.' },
});

judgeRouter.post('/login', loginLimiter, async (req, res) => {
  const { rows } = await pool.query('SELECT judge_id, name FROM judges WHERE code_hash = $1', [hashJudgeCode(req.body?.code)]);
  if (!rows.length) throw new HttpError(401, 'That code is not right. Check it and try again.');
  res.json({ token: signToken({ role: 'judge', judgeId: rows[0].judge_id }), name: rows[0].name });
});

judgeRouter.use(requireJudge);

judgeRouter.get('/events', async (req, res) => {
  const workspace = await getJudgeWorkspace(req.auth.judgeId);
  if (!workspace) throw new HttpError(401, 'This judge account no longer exists.');
  res.json(workspace);
});

/** Loads an event this judge may score right now. */
async function editableEvent(db, eventId, judgeId) {
  const ev = await db.query(
    `SELECT e.status FROM events e JOIN event_judges ej ON ej.event_id = e.event_id
     WHERE e.event_id = $1 AND ej.judge_id = $2`,
    [eventId, judgeId],
  );
  if (!ev.rowCount || ev.rows[0].status === 'draft') throw new HttpError(404, 'Event not found.');
  if (ev.rows[0].status !== 'open') throw new HttpError(409, 'Scoring is closed for this event.');
  const sub = await db.query('SELECT 1 FROM judge_submissions WHERE event_id = $1 AND judge_id = $2', [eventId, judgeId]);
  if (sub.rowCount) throw new HttpError(409, 'You already submitted this event. Ask the organizer to reopen it.');
}

// Autosave for one troop: { troopId, scores: { "<criterionId>": number | null } }
judgeRouter.put('/events/:id/scores', async (req, res) => {
  const eventId = Number.parseInt(req.params.id, 10);
  const { troopId, scores } = req.body ?? {};
  if (!Number.isInteger(eventId) || !Number.isInteger(troopId) || typeof scores !== 'object' || scores === null) {
    throw new HttpError(400, 'Invalid request.');
  }
  await editableEvent(pool, eventId, req.auth.judgeId);

  const troop = await pool.query('SELECT 1 FROM troops WHERE troop_id = $1', [troopId]);
  if (!troop.rowCount) throw new HttpError(404, 'Troop not found.');

  const criteria = await pool.query('SELECT criterion_id, name, max_points FROM event_criteria WHERE event_id = $1', [eventId]);
  const byId = new Map(criteria.rows.map((c) => [String(c.criterion_id), c]));

  for (const [key, raw] of Object.entries(scores)) {
    const c = byId.get(key);
    if (!c) throw new HttpError(400, 'Unknown criterion.');
    if (raw === null || raw === '') {
      await pool.query('DELETE FROM judge_scores WHERE judge_id = $1 AND troop_id = $2 AND criterion_id = $3', [req.auth.judgeId, troopId, c.criterion_id]);
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > c.max_points) {
      throw new HttpError(400, `${c.name} must be between 0 and ${c.max_points}.`);
    }
    await pool.query(
      `INSERT INTO judge_scores (event_id, judge_id, troop_id, criterion_id, score)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (judge_id, troop_id, criterion_id) DO UPDATE SET score = EXCLUDED.score, updated_at = now()`,
      [eventId, req.auth.judgeId, troopId, c.criterion_id, Math.round(value * 100) / 100],
    );
  }
  res.json({ ok: true });
});

judgeRouter.post('/events/:id/submit', async (req, res) => {
  const eventId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(eventId)) throw new HttpError(400, 'Invalid event.');
  await editableEvent(pool, eventId, req.auth.judgeId);

  const [need, have] = await Promise.all([
    pool.query('SELECT (SELECT count(*) FROM troops) * (SELECT count(*) FROM event_criteria WHERE event_id = $1) AS n', [eventId]),
    pool.query('SELECT count(*) AS n FROM judge_scores WHERE event_id = $1 AND judge_id = $2', [eventId, req.auth.judgeId]),
  ]);
  if (Number(have.rows[0].n) < Number(need.rows[0].n)) {
    throw new HttpError(400, `Score every troop on every criterion first (${have.rows[0].n} of ${need.rows[0].n} done).`);
  }
  await pool.query('INSERT INTO judge_submissions (event_id, judge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [eventId, req.auth.judgeId]);
  res.json({ ok: true });
});

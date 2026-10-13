import { Router } from 'express';
import { HttpError, pool, withTransaction } from '../db.js';
import { generateJudgeCode, hashJudgeCode } from '../auth.js';
import { getJudgingOverview } from '../judging.js';

// Mounted under /api/admin, after requireAdmin.
export const judgingAdminRouter = Router();

const idParam = (value, what) => {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id)) throw new HttpError(400, `Invalid ${what}.`);
  return id;
};
const cleanName = (value, what) => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 100) throw new HttpError(400, `${what} must be 1 to 100 characters.`);
  return name;
};

judgingAdminRouter.get('/judging', async (_req, res) => {
  res.json(await getJudgingOverview());
});

// ---- Judges
judgingAdminRouter.post('/judges', async (req, res) => {
  const name = cleanName(req.body?.name, 'Judge name');
  const code = generateJudgeCode();
  const { rows } = await pool.query('INSERT INTO judges (name, code_hash) VALUES ($1, $2) RETURNING judge_id', [name, hashJudgeCode(code)]);
  res.status(201).json({ id: rows[0].judge_id, name, code }); // the code is shown once, never stored
});

judgingAdminRouter.post('/judges/:id/reset-code', async (req, res) => {
  const id = idParam(req.params.id, 'judge');
  const code = generateJudgeCode();
  const { rowCount } = await pool.query('UPDATE judges SET code_hash = $1 WHERE judge_id = $2', [hashJudgeCode(code), id]);
  if (!rowCount) throw new HttpError(404, 'Judge not found.');
  res.json({ code });
});

judgingAdminRouter.delete('/judges/:id', async (req, res) => {
  const id = idParam(req.params.id, 'judge');
  const counted = await pool.query(
    `SELECT 1 FROM judge_submissions s JOIN events e ON e.event_id = s.event_id
     WHERE s.judge_id = $1 AND e.status = 'published' LIMIT 1`,
    [id],
  );
  if (counted.rowCount) throw new HttpError(409, "This judge's scores are counted in published results. Move that event back to open first.");
  const { rowCount } = await pool.query('DELETE FROM judges WHERE judge_id = $1', [id]);
  if (!rowCount) throw new HttpError(404, 'Judge not found.');
  res.json({ ok: true });
});

// ---- Events
judgingAdminRouter.post('/events', async (req, res) => {
  const name = cleanName(req.body?.name, 'Event name');
  const criteria = Array.isArray(req.body?.criteria) ? req.body.criteria : [];
  const judgeIds = Array.isArray(req.body?.judgeIds) ? [...new Set(req.body.judgeIds)] : [];

  if (criteria.length < 1 || criteria.length > 12) throw new HttpError(400, 'Add between 1 and 12 criteria.');
  const cleanCriteria = criteria.map((c, i) => {
    const max = Number(c?.max);
    if (!Number.isInteger(max) || max < 1 || max > 1000) throw new HttpError(400, `Criterion ${i + 1}: max points must be a whole number from 1 to 1000.`);
    return { name: cleanName(c?.name, `Criterion ${i + 1} name`), max };
  });
  if (judgeIds.length < 1 || !judgeIds.every(Number.isInteger)) throw new HttpError(400, 'Choose at least one judge.');

  const created = await withTransaction(async (db) => {
    const dupe = await db.query('SELECT 1 FROM categories WHERE lower(category_name) = lower($1)', [name]);
    if (dupe.rowCount) throw new HttpError(409, 'A game or event with that name already exists.');

    const valid = await db.query('SELECT judge_id FROM judges WHERE judge_id = ANY($1)', [judgeIds]);
    if (valid.rowCount !== judgeIds.length) throw new HttpError(400, 'One of the chosen judges no longer exists.');

    const cat = await db.query('INSERT INTO categories (category_name) VALUES ($1) RETURNING category_id', [name]);
    const ev = await db.query('INSERT INTO events (name, category_id) VALUES ($1, $2) RETURNING event_id', [name, cat.rows[0].category_id]);
    const eventId = ev.rows[0].event_id;
    for (const [i, c] of cleanCriteria.entries()) {
      await db.query('INSERT INTO event_criteria (event_id, name, max_points, sort_order) VALUES ($1, $2, $3, $4)', [eventId, c.name, c.max, i]);
    }
    for (const judgeId of judgeIds) {
      await db.query('INSERT INTO event_judges (event_id, judge_id) VALUES ($1, $2)', [eventId, judgeId]);
    }
    return eventId;
  });

  res.status(201).json({ id: created });
});

// Edit an event's name and criteria (typos, wrong points). Not allowed once published.
// Once any judge has entered a score, criteria can be renamed and re-pointed but not added or removed.
judgingAdminRouter.put('/events/:id', async (req, res) => {
  const id = idParam(req.params.id, 'event');
  const name = cleanName(req.body?.name, 'Event name');
  const criteria = Array.isArray(req.body?.criteria) ? req.body.criteria : [];
  if (criteria.length < 1 || criteria.length > 12) throw new HttpError(400, 'Add between 1 and 12 criteria.');
  const clean = criteria.map((c, i) => {
    const max = Number(c?.max);
    if (!Number.isInteger(max) || max < 1 || max > 1000) throw new HttpError(400, `Criterion ${i + 1}: points must be a whole number from 1 to 1000.`);
    const criterionId = c?.id === undefined || c?.id === null ? null : Number(c.id);
    if (criterionId !== null && !Number.isInteger(criterionId)) throw new HttpError(400, `Criterion ${i + 1} is invalid.`);
    return { id: criterionId, name: cleanName(c?.name, `Criterion ${i + 1} name`), max };
  });

  await withTransaction(async (db) => {
    const ev = await db.query(
      `SELECT e.name, e.status, e.category_id, c.category_name
       FROM events e JOIN categories c ON c.category_id = e.category_id
       WHERE e.event_id = $1 FOR UPDATE OF e`,
      [id],
    );
    if (!ev.rowCount) throw new HttpError(404, 'Event not found.');
    const old = ev.rows[0];
    if (old.status === 'published') throw new HttpError(409, 'Move the event back to open before editing it.');

    // Name. The leaderboard game is renamed too when it was created together with the event.
    if (name !== old.name) {
      const dupeEvent = await db.query('SELECT 1 FROM events WHERE lower(name) = lower($1) AND event_id <> $2', [name, id]);
      if (dupeEvent.rowCount) throw new HttpError(409, 'Another event already has that name.');
      if (old.category_name === old.name) {
        const dupeGame = await db.query('SELECT 1 FROM categories WHERE lower(category_name) = lower($1) AND category_id <> $2', [name, old.category_id]);
        if (dupeGame.rowCount) throw new HttpError(409, 'A game with that name already exists.');
        await db.query('UPDATE categories SET category_name = $1 WHERE category_id = $2', [name, old.category_id]);
      }
      await db.query('UPDATE events SET name = $1 WHERE event_id = $2', [name, id]);
    }

    // Criteria.
    const existing = await db.query('SELECT criterion_id, name, max_points FROM event_criteria WHERE event_id = $1', [id]);
    const existingById = new Map(existing.rows.map((r) => [r.criterion_id, r]));
    const keptIds = new Set(clean.filter((c) => c.id !== null).map((c) => c.id));
    if (clean.some((c) => c.id !== null && !existingById.has(c.id))) throw new HttpError(400, 'One of the criteria no longer exists. Refresh the page.');
    if (keptIds.size !== clean.filter((c) => c.id !== null).length) throw new HttpError(400, 'A criterion appears twice.');

    const added = clean.some((c) => c.id === null);
    const removed = existing.rows.some((r) => !keptIds.has(r.criterion_id));
    const scored = await db.query('SELECT 1 FROM judge_scores WHERE event_id = $1 LIMIT 1', [id]);
    if (scored.rowCount && (added || removed)) {
      throw new HttpError(409, 'Judges have already started scoring. You can rename criteria and change their points, but not add or remove them.');
    }

    for (const c of clean) {
      if (c.id === null) continue;
      if (c.max < existingById.get(c.id).max_points) {
        const tooHigh = await db.query('SELECT 1 FROM judge_scores WHERE criterion_id = $1 AND score > $2 LIMIT 1', [c.id, c.max]);
        if (tooHigh.rowCount) throw new HttpError(409, `"${c.name}" already has scores above ${c.max}. Ask judges to fix those first, or keep the points higher.`);
      }
    }

    if (removed) await db.query('DELETE FROM event_criteria WHERE event_id = $1 AND NOT (criterion_id = ANY($2))', [id, [...keptIds]]);
    for (const [i, c] of clean.entries()) {
      if (c.id === null) {
        await db.query('INSERT INTO event_criteria (event_id, name, max_points, sort_order) VALUES ($1, $2, $3, $4)', [id, c.name, c.max, i]);
      } else {
        await db.query('UPDATE event_criteria SET name = $1, max_points = $2, sort_order = $3 WHERE criterion_id = $4', [c.name, c.max, i, c.id]);
      }
    }
  });
  res.json({ ok: true });
});

judgingAdminRouter.put('/events/:id/judges', async (req, res) => {
  const id = idParam(req.params.id, 'event');
  const judgeIds = Array.isArray(req.body?.judgeIds) ? [...new Set(req.body.judgeIds)] : [];
  if (judgeIds.length < 1 || !judgeIds.every(Number.isInteger)) throw new HttpError(400, 'Choose at least one judge.');

  await withTransaction(async (db) => {
    const ev = await db.query('SELECT status FROM events WHERE event_id = $1 FOR UPDATE', [id]);
    if (!ev.rowCount) throw new HttpError(404, 'Event not found.');
    if (ev.rows[0].status === 'published') throw new HttpError(409, 'Move the event back to open before changing its judges.');
    const valid = await db.query('SELECT judge_id FROM judges WHERE judge_id = ANY($1)', [judgeIds]);
    if (valid.rowCount !== judgeIds.length) throw new HttpError(400, 'One of the chosen judges no longer exists.');

    await db.query('DELETE FROM event_judges WHERE event_id = $1 AND NOT (judge_id = ANY($2))', [id, judgeIds]);
    // A removed judge's scores and submission no longer count.
    await db.query('DELETE FROM judge_scores WHERE event_id = $1 AND NOT (judge_id = ANY($2))', [id, judgeIds]);
    await db.query('DELETE FROM judge_submissions WHERE event_id = $1 AND NOT (judge_id = ANY($2))', [id, judgeIds]);
    for (const judgeId of judgeIds) {
      await db.query('INSERT INTO event_judges (event_id, judge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, judgeId]);
    }
  });
  res.json({ ok: true });
});

judgingAdminRouter.post('/events/:id/status', async (req, res) => {
  const id = idParam(req.params.id, 'event');
  const status = req.body?.status;
  if (!['draft', 'open', 'published'].includes(status)) throw new HttpError(400, 'Invalid status.');

  if (status === 'published') {
    const subs = await pool.query('SELECT 1 FROM judge_submissions WHERE event_id = $1 LIMIT 1', [id]);
    if (!subs.rowCount) throw new HttpError(400, 'No judge has submitted scores yet, so there is nothing to publish.');
  }
  const { rowCount } = await pool.query('UPDATE events SET status = $1 WHERE event_id = $2', [status, id]);
  if (!rowCount) throw new HttpError(404, 'Event not found.');
  res.json({ ok: true });
});

// Lets a judge edit again after submitting (their scores stay; they just need to submit once more).
judgingAdminRouter.post('/events/:id/judges/:judgeId/reopen', async (req, res) => {
  const id = idParam(req.params.id, 'event');
  const judgeId = idParam(req.params.judgeId, 'judge');
  const ev = await pool.query('SELECT status FROM events WHERE event_id = $1', [id]);
  if (!ev.rowCount) throw new HttpError(404, 'Event not found.');
  if (ev.rows[0].status === 'published') throw new HttpError(409, 'Move the event back to open first.');
  await pool.query('DELETE FROM judge_submissions WHERE event_id = $1 AND judge_id = $2', [id, judgeId]);
  res.json({ ok: true });
});

// Deleting an event also removes its game from the leaderboard.
judgingAdminRouter.delete('/events/:id', async (req, res) => {
  const id = idParam(req.params.id, 'event');
  const { rows } = await pool.query('SELECT category_id FROM events WHERE event_id = $1', [id]);
  if (!rows.length) throw new HttpError(404, 'Event not found.');
  await pool.query('DELETE FROM categories WHERE category_id = $1', [rows[0].category_id]); // cascades to the event
  res.json({ ok: true });
});
